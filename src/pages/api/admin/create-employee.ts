import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' })
    }

    const { email, password, fullName, role, department } = req.body

    // Debug logging
    console.log('Received data:', { email, password, fullName, role, department })

    if (!email || !password || !fullName) {
        console.log('Missing fields:', { email: !!email, password: !!password, fullName: !!fullName })
        return res.status(400).json({ message: 'Missing required fields' })
    }

    // initialize Supabase Admin Client
    // This requires the SERVICE ROLE KEY to be set in .env.local
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    try {
        // 1. Check if user already exists in Supabase Auth
        const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (checkError) {
            console.error('Error checking existing users:', checkError)
            return res.status(500).json({ message: 'Failed to check existing users' })
        }

        const userExists = existingUser.users.some(user => user.email === email)
        
        if (userExists) {
            // User exists in Auth, check if they also exist in employees table
            const { data: existingEmployee, error: employeeCheckError } = await supabaseAdmin
                .schema('attendance')
                .from('employees')
                .select('email')
                .eq('email', email)
                .single()
            
            if (employeeCheckError && employeeCheckError.code !== 'PGRST116') {
                console.error('Error checking existing employee:', employeeCheckError)
                return res.status(500).json({ message: 'Failed to check existing employee' })
            }
            
            if (existingEmployee) {
                // User exists in both Auth and employees table
                return res.status(400).json({ message: 'This user already exists in the system' })
            }
            
            // User exists in Auth but not in employees table, add to employees table only
            console.log('User exists in Auth, adding to employees table only')
            
            try {
                const { error: dbError } = await supabaseAdmin
                    .schema('attendance')
                    .from('employees')
                    .insert({
                        email,
                        full_name: fullName,
                        role: role || 'employee',
                        department: department || '',
                        password_changed: false,
                    })

                if (dbError) {
                    console.error('Database insert error:', dbError)
                    
                    // Check for specific constraint errors
                    if (dbError.code === '23505' || dbError.message.includes('duplicate key')) {
                        return res.status(400).json({ message: 'This user already exists in the system' })
                    }
                    
                    return res.status(500).json({ message: dbError.message || 'Failed to create employee record' })
                }

                return res.status(200).json({ message: 'Employee record created successfully (user already existed)' })
            } catch (insertError) {
                console.error('Insert error:', insertError)
                return res.status(500).json({ message: 'Failed to create employee record' })
            }
        }

        // 2. Create User in Supabase Auth (only if doesn't exist)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm the user so they can login immediately
            user_metadata: { full_name: fullName }
        })

        if (authError) {
            // Handle specific error cases
            if (authError.message.includes('User already registered')) {
                return res.status(400).json({ message: 'This user already exists in the system' })
            }
            throw authError
        }

        // 2. Insert into the attendance.employees table
        // We use the email as the link.
        const { error: dbError } = await supabaseAdmin
            .schema('attendance')
            .from('employees')
            .insert({
                email,
                full_name: fullName,
                role: role || 'employee',
                department: department || '',
                password_changed: false, // New employees must change password
            })

        if (dbError) {
            // Rollback: try to delete the auth user if DB insert fails to keep consistency
            if (authData.user) {
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            }
            throw dbError
        }

        return res.status(200).json({ message: 'User created successfully', user: authData.user })

    } catch (error: unknown) {
        console.error('Error creating employee:', error)
        
        // Handle different types of errors
        if (error instanceof Error) {
            // Check for specific error messages
            if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
                return res.status(400).json({ message: 'This user already exists in the system' })
            }
            return res.status(500).json({ message: error.message || 'Internal Server Error' })
        }
        
        return res.status(500).json({ message: 'An unexpected error occurred' })
    }
}
