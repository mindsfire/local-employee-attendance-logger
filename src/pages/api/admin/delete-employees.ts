import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ message: 'Method not allowed' })
    }

    const { emails } = req.body

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ message: 'Emails array is required' })
    }

    // Initialize Supabase Admin Client
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
        console.log('Deleting employees:', emails)

        // Step 1: Get user IDs from Supabase Auth for the emails
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
        
        if (authError) {
            console.error('Error fetching auth users:', authError)
            return res.status(500).json({ message: 'Failed to fetch auth users' })
        }

        // Find users to delete from Auth
        const usersToDelete = authUsers.users.filter(user => 
            emails.includes(user.email || '')
        )

        console.log('Found auth users to delete:', usersToDelete.map(u => u.email))

        // Step 2: Delete from employees table
        const { error: dbError } = await supabaseAdmin
            .schema('attendance')
            .from('employees')
            .delete()
            .in('email', emails)

        if (dbError) {
            console.error('Error deleting from employees table:', dbError)
            return res.status(500).json({ message: 'Failed to delete employees from database' })
        }

        // Step 3: Delete from Supabase Auth
        const authDeleteErrors = []
        for (const user of usersToDelete) {
            if (user.id) {
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
                if (deleteError) {
                    console.error(`Error deleting auth user ${user.email}:`, deleteError)
                    authDeleteErrors.push(`${user.email}: ${deleteError.message}`)
                } else {
                    console.log(`Successfully deleted auth user: ${user.email}`)
                }
            }
        }

        // Step 4: Return results
        if (authDeleteErrors.length > 0) {
            return res.status(207).json({ 
                message: 'Employees deleted from database, but some auth users could not be deleted',
                details: authDeleteErrors,
                deletedFromDatabase: emails.length,
                deletedFromAuth: usersToDelete.length - authDeleteErrors.length
            })
        }

        return res.status(200).json({ 
            message: 'Successfully deleted employees from both database and auth',
            deletedFromDatabase: emails.length,
            deletedFromAuth: usersToDelete.length
        })

    } catch (error: unknown) {
        console.error('Error deleting employees:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return res.status(500).json({ message: errorMessage || 'Internal Server Error' })
    }
}
