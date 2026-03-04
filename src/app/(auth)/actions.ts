"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: {
  email: string;
  password: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/command-center");
}

export async function signUp(formData: {
  fullName: string;
  email: string;
  password: string;
  organizationName: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Signup succeeded but no user was returned." };
  }

  const slug = formData.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: formData.organizationName, slug })
    .select("id")
    .single();

  if (orgError) {
    return { error: `Failed to create organization: ${orgError.message}` };
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: data.user.id,
      role: "admin",
      is_primary: true,
    });

  if (memberError) {
    return { error: `Failed to add user to organization: ${memberError.message}` };
  }

  await supabase
    .from("user_profiles")
    .update({ current_organization_id: org.id })
    .eq("id", data.user.id);

  redirect("/command-center");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
