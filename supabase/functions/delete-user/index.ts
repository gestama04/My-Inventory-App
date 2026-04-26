import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const projectUrl = Deno.env.get('PROJECT_URL')
    const anonKey = Deno.env.get('PROJECT_ANON_KEY')
    const serviceRoleKey = Deno.env.get('PROJECT_SERVICE_ROLE_KEY')

    if (!projectUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing secrets' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(projectUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(projectUrl, serviceRoleKey)

    await supabaseAdmin.from('supplement_logs').delete().eq('user_id', user.id)
    await supabaseAdmin.from('supplements').delete().eq('user_id', user.id)
    await supabaseAdmin.from('profiles').delete().eq('user_id', user.id)
    await supabaseAdmin.from('profiles').delete().eq('id', user.id)

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      throw deleteError
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('DELETE USER ERROR:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})