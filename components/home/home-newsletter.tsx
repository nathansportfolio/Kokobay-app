import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export function HomeNewsletter() {
  const [email, setEmail] = useState('');

  return (
    <View className="mx-5 mb-10 border border-line bg-surface px-5 py-10">
      <Text className="mb-2 font-sans-md text-[11px] uppercase tracking-[0.26em] text-accent">
        Newsletter
      </Text>
      <Text className="mb-2 font-sans-bold text-[22px] leading-7 tracking-wide text-ink">
        Notes from the bay
      </Text>
      <Text variant="body" className="mb-6 text-[15px] leading-6">
        Private previews, restocks, and one annual letter — unhurried, like the tide.
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor="#71717A"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className="mb-4 border border-line bg-canvas px-4 py-3.5 font-sans text-[15px] text-ink"
      />
      <Button title="Request invitation" variant="primary" onPress={() => setEmail('')} />
    </View>
  );
}
