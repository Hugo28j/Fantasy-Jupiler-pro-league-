import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function normalizeUsername(value: unknown){
  return String(value || "").trim().replace(/\s+/g," ").toLowerCase();
}

function usernameEmail(value: string){
  const normalized = normalizeUsername(value);
  const bytes = new TextEncoder().encode(normalized);
  const hex = Array.from(bytes,b => b.toString(16).padStart(2,"0")).join("");
  return "u-" + hex + "@fantasy.invalid";
}

Deno.serve(async request => {
  if(request.method === "OPTIONS"){
    return new Response("ok",{headers:corsHeaders});
  }

  if(request.method !== "POST"){
    return Response.json({ok:false,error:"Alleen POST is toegestaan."},{status:405,headers:corsHeaders});
  }

  try{
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if(username.length < 1 || username.length > 28){
      return Response.json({ok:false,error:"Kies een naam van 1 tot 28 tekens."},{status:400,headers:corsHeaders});
    }
    if(username.includes("@")){
      return Response.json({ok:false,error:"Gebruik alleen een naam, geen e-mailadres."},{status:400,headers:corsHeaders});
    }
    if(password.length < 4){
      return Response.json({ok:false,error:"Je wachtwoord moet minstens 4 tekens hebben."},{status:400,headers:corsHeaders});
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl || !serviceRoleKey){
      throw new Error("Supabase serverconfig ontbreekt.");
    }

    const admin = createClient(supabaseUrl,serviceRoleKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const email = usernameEmail(username);
    const {data,error} = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm:true,
      user_metadata:{display_name:username}
    });

    if(error){
      const message = String(error.message || "");
      if(/already|registered|exists|duplicate/i.test(message)){
        return Response.json({ok:false,error:"Deze naam is al in gebruik."},{status:409,headers:corsHeaders});
      }
      if(/password/i.test(message)){
        return Response.json({ok:false,error:message},{status:400,headers:corsHeaders});
      }
      throw error;
    }

    return Response.json({ok:true,userId:data.user?.id || null},{headers:corsHeaders});
  }catch(error){
    console.error(error);
    return Response.json(
      {ok:false,error:"Account kon niet worden gemaakt."},
      {status:500,headers:corsHeaders}
    );
  }
});
