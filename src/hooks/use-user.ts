'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';
import type { UserRole } from '@/lib/constants';

type UserProfile = Tables<'user_profiles'>;
type OrganizationMember = Tables<'organization_members'>;
type Organization = Tables<'organizations'>;

export interface UserData {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  organization: Organization | null;
  role: UserRole | null;
  isLoading: boolean;
}

export function useUser(): UserData {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const fetchUserData = useCallback(async (userId: string) => {
    setIsLoading(true);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        setProfile(null);
        setOrganization(null);
        setRole(null);
        return;
      }

      setProfile(profileData);

      const orgId = profileData.current_organization_id;
      if (!orgId) {
        setOrganization(null);
        setRole(null);
        return;
      }

      const [memberResult, orgResult] = await Promise.all([
        supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userId)
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .single(),
        supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single(),
      ]);

      if (orgResult.data) {
        setOrganization(orgResult.data);
      }

      if (memberResult.data) {
        setRole(memberResult.data.role as UserRole);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const authUser = { id: session.user.id, email: session.user.email ?? '' };
          setUser(authUser);
          void fetchUserData(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setOrganization(null);
          setRole(null);
          setIsLoading(false);
        }
      },
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const authUser = { id: session.user.id, email: session.user.email ?? '' };
        setUser(authUser);
        void fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserData]);

  return { user, profile, organization, role, isLoading };
}
