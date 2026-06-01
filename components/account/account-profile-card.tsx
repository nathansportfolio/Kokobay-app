import { View } from 'react-native';

import { AccountCard, AccountCardBody } from '@/components/account/account-layout';
import { Text } from '@/components/ui/text';
import type { AuthUser } from '@/types/auth';

function initialsForUser(user: AuthUser): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  const fromName = `${first}${last}`.toUpperCase();
  if (fromName) return fromName.slice(0, 2);
  const email = user.email?.trim().charAt(0);
  return email ? email.toUpperCase() : '?';
}

type AccountProfileCardProps = {
  user: AuthUser;
};

export function AccountProfileCard({ user }: AccountProfileCardProps) {
  const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = initialsForUser(user);

  return (
    <AccountCard>
      <AccountCardBody className="flex-row items-center gap-4 py-3.5">
        <View
          className="h-11 w-11 items-center justify-center rounded-full border border-line/50 bg-warmElevated/80"
          accessibilityElementsHidden>
          <Text className="font-sans-md text-[13px] tracking-[0.06em] text-accent">{initials}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-md text-[16px] leading-[22px] tracking-[-0.15px] text-ink" numberOfLines={1}>
            {displayName}
          </Text>
          <Text variant="caption" className="mt-0.5 text-mist" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </AccountCardBody>
    </AccountCard>
  );
}
