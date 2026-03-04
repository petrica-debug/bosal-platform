import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uyezrafpaitkybmeuysw.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_ORG_ID = "a0000000-0000-0000-0000-000000000001";

const DEMO_EMAIL = "admin@aftermarketos.com";
const DEMO_PASSWORD = "AftermarketOS2026!";
const DEMO_NAME = "Demo Admin";

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Creating demo admin user...");

  // Create user via admin API (bypasses email confirmation)
  const { data: userData, error: createError } =
    await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_NAME },
    });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      console.log("User already exists, fetching...");
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === DEMO_EMAIL);
      if (!existing) {
        console.error("Could not find existing user");
        process.exit(1);
      }
      // Update password in case it changed
      await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
      });
      await linkToOrg(supabase, existing.id);
      return;
    }
    console.error("Failed to create user:", createError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`User created: ${userId}`);

  await linkToOrg(supabase, userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function linkToOrg(supabase: any, userId: string) {
  // Update user profile with current org
  console.log("Setting current organization on profile...");
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      current_organization_id: DEMO_ORG_ID,
      full_name: DEMO_NAME,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("Failed to update profile:", profileError.message);
  }

  // Add as admin member of demo org (upsert to avoid duplicates)
  console.log("Adding user as admin of demo organization...");
  const { error: memberError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: DEMO_ORG_ID,
        user_id: userId,
        role: "admin",
        is_primary: true,
      },
      { onConflict: "organization_id,user_id" }
    );

  if (memberError) {
    console.error("Failed to add org member:", memberError.message);
  }

  console.log("\n========================================");
  console.log("  Demo Admin Account Ready!");
  console.log("========================================");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Role:     admin`);
  console.log(`  Org:      Bosal Aftermarket`);
  console.log("========================================\n");
}

main().catch(console.error);
