import { ManualModal } from '@/components/manual/ManualModal';
import { useTutorials } from '@/hooks/tutorials';
import { Stack, useRouter } from 'expo-router';

export default function ManualScreen() {
  const router = useRouter();
  const { markCompleted } = useTutorials();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ManualModal
        visible={true}
        onClose={() => router.back()}
        onComplete={() => {
          markCompleted('full-manual');
          router.back();
        }}
      />
    </>
  );
}
