import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' })
    }

    const { email, password, fullName, role, department } = req.body

    // Debug logging
    console.log('[API: create-employee] Received data:', { email, password: '***', fullName, role, department })

    if (!email || !password || !fullName) {
        console.log('[API: create-employee] Missing fields error');
        return res.status(400).json({ message: 'Missing required fields' })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[API: create-employee] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing');
        return res.status(500).json({ message: 'Server configuration error' })
    }

    // initialize Supabase Admin Client
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
        console.log('[API: create-employee] Checking for existing user in Auth...');
        const { data: userData, error: checkError } = await supabaseAdmin.auth.admin.listUsers()

        if (checkError) {
            console.error('[API: create-employee] Auth check error:', checkError)
            return res.status(500).json({ message: 'Failed to check existing users' })
        }

        const userExists = userData.users.some(user => user.email === email)
        console.log('[API: create-employee] User exists in Auth:', userExists);

        if (userExists) {
            console.log('[API: create-employee] User exists in Auth, checking employees table...');
            const { data: existingEmployee, error: employeeCheckError } = await supabaseAdmin
                .schema('attendance')
                .from('employees')
                .select('email')
                .eq('email', email)
                .single()

            if (employeeCheckError && employeeCheckError.code !== 'PGRST116') {
                console.error('[API: create-employee] Employee DB check error:', employeeCheckError)
                return res.status(500).json({ message: 'Failed to check existing employee' })
            }

            if (existingEmployee) {
                console.log('[API: create-employee] User exists in both. Returning 400.');
                return res.status(400).json({ message: 'This user already exists in the system' })
            }

            console.log('[API: create-employee] User in Auth but not in DB table. Adding to DB...')
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
                console.error('[API: create-employee] Database insert error (partial exists):', dbError)
                return res.status(500).json({ message: dbError.message || 'Failed to create employee record' })
            }

            console.log('[API: create-employee] Success (partial exists)');
            return res.status(200).json({ message: 'Employee record created successfully (user already existed)' })
        }

        console.log('[API: create-employee] Creating new Auth user...');
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        })

        if (authError) {
            console.error('[API: create-employee] Auth creation error:', authError);
            if (authError.message.includes('User already registered')) {
                return res.status(400).json({ message: 'This user already exists in the system' })
            }
            throw authError
        }

        console.log('[API: create-employee] Auth user created. Inserting into DB...');
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
            console.error('[API: create-employee] DB Insert error. Rolling back Auth user:', dbError)
            if (authData.user) {
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            }
            throw dbError
        }

        console.log('[API: create-employee] Full success');
        return res.status(200).json({ message: 'User created successfully', user: authData.user })

    } catch (error: unknown) {
        console.error('[API: create-employee] Unhandled error:', error)
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return res.status(500).json({ message })
    }
}
