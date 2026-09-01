import { degreesToMils, getMagneticDeclination } from '@/components/map/converter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useGPS } from '@/hooks/gps';
import { useSettings } from '@/hooks/settings';
import { computeTilt, useSensors } from '@/hooks/useSensors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { utmGridConvergence } from '@/lib/mgrs';
import Constants from 'expo-constants';
import { Pedometer } from 'expo-sensors';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

function formatAngle(v: number | null, angleUnit: string) {
  if (v == null || !Number.isFinite(v)) return '-';
  if (angleUnit === 'mils') return `${Math.round(degreesToMils(v, { normalize: false }))} mils`;
  return `${v.toFixed(2)}deg`;
}
function formatMeters(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v as number)) return '-';
  return (v as number) < 1 ? `+-${(v as number).toFixed(1)} m` : `+-${Math.round(v as number)} m`;
}
function fmt(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}
function ageMs(ts: number | null | undefined) {
  if (!ts) return '-';
  const d = Date.now() - ts;
  if (d < 1000) return `${d} ms ago`;
  if (d < 60000) return `${(d / 1000).toFixed(1)} s ago`;
  return `${(d / 60000).toFixed(1)} min ago`;
}
function pressureToAltitudeM(pHpa: number, p0 = 1013.25) {
  // Barometric formula (ISA) - rough but useful for field altitude cross-check
  if (!Number.isFinite(pHpa) || pHpa <= 0) return null;
  return 44330 * (1 - Math.pow(pHpa / p0, 1 / 5.255));
}

export default function AboutContent() {
  const { lastLocation } = useGPS();
  const { angleUnit } = useSettings();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [declination, setDeclination] = useState<number | null>(null);
  // Battery aware: sensors off by default. User opts in.
  const [sensorsEnabled, setSensorsEnabled] = useState(false);
  const [extrasEnabled, setExtrasEnabled] = useState(false);

  // Only core sensors by default; extras (barometer, light, motion, raw mag) only when user enables extras.
  // This keeps battery use minimal when About is open.
  const {
    magnetometer,
    gyroscope,
    accelerometer,
    barometer,
    lightSensor,
    deviceMotion,
    magnetometerUncalibrated,
    isMagnetometerAvailable,
    isGyroscopeAvailable,
    isAccelerometerAvailable,
    isBarometerAvailable,
    isLightSensorAvailable,
    isDeviceMotionAvailable,
    isMagnetometerUncalibratedAvailable,
  } = useSensors({
    enabled: sensorsEnabled,
    enableMagnetometer: true,
    enableGyroscope: true,
    enableAccelerometer: true,
    enableBarometer: extrasEnabled,
    enableLightSensor: extrasEnabled,
    enableDeviceMotion: extrasEnabled,
    enableMagnetometerUncalibrated: extrasEnabled,
  });

  const tilt = useMemo(() => computeTilt(accelerometer), [accelerometer]);

  // Pedometer is permission gated and costs motion processing. Only query when extras are enabled.
  const [pedometerAvailable, setPedometerAvailable] = useState<boolean | null>(null);
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [pedometerPerm, setPedometerPerm] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!sensorsEnabled || !extrasEnabled) {
      setPedometerAvailable(null);
      setStepsToday(null);
      setPedometerPerm(null);
      return;
    }
    void (async () => {
      try {
        const avail = await Pedometer.isAvailableAsync().catch(() => false);
        if (!active) return;
        setPedometerAvailable(avail);
        if (!avail) return;
        const perm = await Pedometer.getPermissionsAsync().catch(() => null);
        if (!active) return;
        setPedometerPerm(perm?.status ?? null);
        let granted = perm?.status === 'granted';
        if (!granted) {
          const req = await Pedometer.requestPermissionsAsync().catch(() => null);
          if (!active) return;
          setPedometerPerm(req?.status ?? null);
          granted = req?.status === 'granted';
        }
        if (!granted) return;
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const res = await Pedometer.getStepCountAsync(start, now).catch(() => null);
        if (!active) return;
        setStepsToday(res?.steps ?? null);
      } catch {
        if (active) setPedometerAvailable(false);
      }
    })();
    return () => { active = false; };
  }, [sensorsEnabled, extrasEnabled]);

  useEffect(() => {
    let active = true;
    if (!lastLocation) { setDeclination(null); return; }
    const { latitude: lat, longitude: lon, altitude } = lastLocation.coords;
    (async () => {
      try {
        const altKm = altitude != null ? altitude / 1000 : 0;
        const d = await getMagneticDeclination(lat, lon, new Date(), { altitudeKm: altKm });
        if (active) setDeclination(d);
      } catch { if (active) setDeclination(null); }
    })();
    return () => { active = false; };
  }, [lastLocation]);

  const appName = Constants.expoConfig?.name ?? 'CadNav2';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const runtimeVersion = (Constants.expoConfig as any)?.runtimeVersion ?? (Constants as any)?.manifest2?.extra?.eas?.projectId ? 'EAS' : '-';
  const open = (url: string) => { void Linking.openURL(url); };
  const openManualApiKey = () => {
    // Close the About modal is handled by parent, but we can navigate to manual screen.
    // Using router push ensures the API key guide is one tap away.
    try { router.push('/manual'); } catch { open('https://github.com/Lack-Of-Name/CadNav2#configuration'); }
  };

  const baroAltitude = barometer ? pressureToAltitudeM(barometer.pressure) : null;

  return (
    <ThemedView style={styles.card}>
      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={[styles.heroIcon, { backgroundColor: theme.primary }]}>
          <IconSymbol name="map.fill" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="title" style={styles.title}>{appName}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textMuted }]}>Version {appVersion} on {Platform.OS} using Expo {Constants.expoConfig ? 'managed' : '-'}</ThemedText>
          <ThemedText style={[styles.caption, { color: theme.textSubtle }]}>Offline first MGRS field navigation built with MapLibre plus MapTiler plus WMMHR</ThemedText>
        </View>
      </View>

      <View style={[styles.ctaRow, { borderColor: theme.divider }]}>
        <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2')} style={[styles.ctaBtn, { backgroundColor: theme.primary }]}>
          <IconSymbol name="star.fill" size={14} color="#fff" />
          <ThemedText style={[styles.ctaBtnText, { color: '#fff' }]}>GitHub</ThemedText>
        </Pressable>
        <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/issues')} style={[styles.ctaBtn, { backgroundColor: theme.surface, borderColor: theme.divider, borderWidth: StyleSheet.hairlineWidth }]}>
          <ThemedText style={[styles.ctaBtnText, { color: theme.text }]}>Report issue</ThemedText>
        </Pressable>
        <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/releases')} style={[styles.ctaBtn, { backgroundColor: theme.surface, borderColor: theme.divider, borderWidth: StyleSheet.hairlineWidth }]}>
          <ThemedText style={[styles.ctaBtnText, { color: theme.text }]}>Releases</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.apiKeyCard, { backgroundColor: theme.background, borderColor: theme.divider }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.apiKeyTitle, { color: theme.text }]}>Need a map key</ThemedText>
          <ThemedText style={[styles.apiKeyDesc, { color: theme.textMuted }]}>
            CadNav uses MapTiler for tiles. A free key takes about 2 minutes and no credit card is needed. You can also use offline maps without a key.
          </ThemedText>
        </View>
        <Pressable onPress={openManualApiKey} style={[styles.apiKeyBtn, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.apiKeyBtnText, { color: '#fff' }]}>Open API key guide</ThemedText>
        </Pressable>
        <Pressable onPress={() => open('https://cloud.maptiler.com/account/keys')} style={[styles.apiKeyBtn, { backgroundColor: theme.surface, borderColor: theme.divider, borderWidth: StyleSheet.hairlineWidth }]}>
          <ThemedText style={[styles.apiKeyBtnText, { color: theme.text }]}>Go to MapTiler keys</ThemedText>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="info.circle.fill" size={16} color={theme.textMuted} />
          <ThemedText style={styles.sectionTitle}>Build and device</ThemedText>
        </View>
        <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <KvRow label="App" value={`${appName} ${appVersion}`} />
          <KvRow label="Platform" value={`${Platform.OS} ${Platform.Version ?? ''}`.trim()} />
          <KvRow label="Expo SDK" value={`${Constants.expoConfig ? `~${(Constants as any).expoConfig?.sdkVersion ?? '54'}` : '-'}`} />
          <KvRow label="Runtime" value={String(runtimeVersion)} last />
        </View>
        <ThemedText style={[styles.hint, { color: theme.textSubtle }]}>
          Bundle: {(Constants as any).expoConfig?.slug ?? 'cadnav2'} and EAS project {(Constants.expoConfig?.extra as any)?.eas?.projectId ? 'linked' : 'not linked'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="location.fill" size={16} color={theme.primary} />
          <ThemedText style={styles.sectionTitle}>Location</ThemedText>
          {lastLocation && <View style={[styles.liveDot, { backgroundColor: theme.success }]} />}
          <ThemedText style={[styles.liveLabel, { color: theme.textMuted }]}>{lastLocation ? 'live' : 'no fix'}</ThemedText>
        </View>
        <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          {lastLocation ? (
            <>
              <KvRow label="Latitude" value={String(lastLocation.coords.latitude)} mono />
              <KvRow label="Longitude" value={String(lastLocation.coords.longitude)} mono />
              <KvRow label="Accuracy" value={formatMeters(lastLocation.coords.accuracy)} />
              <KvRow label="Altitude" value={lastLocation.coords.altitude != null ? `${fmt(lastLocation.coords.altitude, 1)} m` : '-'} />
              <KvRow label="Speed" value={lastLocation.coords.speed != null ? `${fmt(lastLocation.coords.speed as number, 1)} m/s` : '-'} />
              <KvRow label="Mag heading" value={lastLocation.coords.magHeading != null ? formatAngle(lastLocation.coords.magHeading, angleUnit) : '-'} />
              <KvRow label="True heading" value={lastLocation.coords.trueHeading != null ? formatAngle(lastLocation.coords.trueHeading, angleUnit) : '-'} />
              <KvRow label="Head accuracy" value={lastLocation.coords.headingAccuracy != null ? `+-${fmt(lastLocation.coords.headingAccuracy as number, 1)}deg` : '-'} />
              <KvRow label="Declination" value={formatAngle(declination, angleUnit)} />
              <KvRow label="Grid convergence" value={formatAngle(utmGridConvergence(lastLocation.coords.latitude, lastLocation.coords.longitude), angleUnit)} />
              <KvRow label="Grid to magnetic" value={declination != null ? formatAngle(declination - utmGridConvergence(lastLocation.coords.latitude, lastLocation.coords.longitude), angleUnit) : '-'} />
              <KvRow label="Timestamp" value={new Date(lastLocation.timestamp).toLocaleString()} mono last />
            </>
          ) : (
            <ThemedText style={[styles.text, { color: theme.textMuted, padding: 10 }]}>No location available. Grant location permission and wait for a GPS fix. Tile caching still works offline.</ThemedText>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="sensor.tag.radiowaves.forward.fill" size={16} color={theme.warning} />
          <ThemedText style={styles.sectionTitle}>Device sensors</ThemedText>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setSensorsEnabled((v) => !v)}
            style={[styles.toggle, { backgroundColor: sensorsEnabled ? theme.primary : theme.surface, borderColor: theme.divider }]}
          >
            <ThemedText style={[styles.toggleText, { color: sensorsEnabled ? '#fff' : theme.textMuted }]}>
              {sensorsEnabled ? 'Live' : 'Off'}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText style={[styles.hint, { color: theme.textSubtle }]}>
          Powered by expo-sensors. Core sensors are magnetometer, accelerometer and gyroscope. Extra sensors are off by default to save battery.
        </ThemedText>
        {!sensorsEnabled ? (
          <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider, padding: 12 }]}>
            <ThemedText style={[styles.text, { color: theme.textMuted }]}>
              Sensors are off to save battery. Turn on to see live magnetometer, accelerometer and gyroscope data. Extra sensors remain off until you enable them below.
            </ThemedText>
          </View>
        ) : Platform.OS === 'web' ? (
          <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider, padding: 12 }]}>
            <ThemedText style={[styles.text, { color: theme.textMuted }]}>Sensors unavailable on web. Open a native build (Expo dev client, TestFlight or APK) to see live diagnostics.</ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            <SensorBlock
              icon="compass.drawing"
              title="Magnetometer"
              subtitle="microtesla, calibrated"
              available={isMagnetometerAvailable}
              age={magnetometer ? ageMs(magnetometer.timestamp) : '-'}
              theme={theme}
            >
              {magnetometer ? (
                <>
                  <MonoKV k="x" v={`${fmt(magnetometer.x, 1)} uT`} />
                  <MonoKV k="y" v={`${fmt(magnetometer.y, 1)} uT`} />
                  <MonoKV k="z" v={`${fmt(magnetometer.z, 1)} uT`} />
                  <MonoKV k="|B|" v={`${fmt(magnetometer.magnitude, 1)} uT`} accent />
                </>
              ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>Waiting for samples</ThemedText>}
              <ThemedText style={[styles.microHint, { color: theme.textSubtle }]}>Tip: if |B| is about 25 to 65 uT you have a clean field. Above 80 uT often means nearby metal or a phone case. Calibrate with a figure eight motion.</ThemedText>
            </SensorBlock>

            <SensorBlock
              icon="move.3d"
              title="Accelerometer"
              subtitle={`g force${tilt ? `, pitch ${fmt(tilt.pitch, 1)}deg roll ${fmt(tilt.roll, 1)}deg` : ''}`}
              available={isAccelerometerAvailable}
              age={accelerometer ? ageMs(accelerometer.timestamp) : '-'}
              theme={theme}
            >
              {accelerometer ? (
                <>
                  <MonoKV k="x" v={`${fmt(accelerometer.x, 3)} g`} />
                  <MonoKV k="y" v={`${fmt(accelerometer.y, 3)} g`} />
                  <MonoKV k="z" v={`${fmt(accelerometer.z, 3)} g`} />
                  <MonoKV k="|a|" v={`${fmt(Math.sqrt(accelerometer.x ** 2 + accelerometer.y ** 2 + accelerometer.z ** 2), 3)} g`} />
                  {tilt && (
                    <View style={[styles.inlineBadgeRow, { marginTop: 6 }]}>
                      <Badge label={`Pitch ${fmt(tilt.pitch, 1)}deg`} theme={theme} />
                      <Badge label={`Roll ${fmt(tilt.roll, 1)}deg`} theme={theme} />
                      <Badge label={Math.abs(tilt.pitch) > 30 || Math.abs(tilt.roll) > 30 ? 'Unlevel - compass may be off' : 'Level'} tone={Math.abs(tilt.pitch) > 30 || Math.abs(tilt.roll) > 30 ? 'warning' : 'ok'} theme={theme} />
                    </View>
                  )}
                </>
              ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>Waiting</ThemedText>}
            </SensorBlock>

            <SensorBlock
              icon="gyroscope"
              title="Gyroscope"
              subtitle="rad per second, rotation rate"
              available={isGyroscopeAvailable}
              age={gyroscope ? ageMs(gyroscope.timestamp) : '-'}
              theme={theme}
            >
              {gyroscope ? (
                <>
                  <MonoKV k="x" v={`${fmt(gyroscope.x, 3)} rad/s`} />
                  <MonoKV k="y" v={`${fmt(gyroscope.y, 3)} rad/s`} />
                  <MonoKV k="z" v={`${fmt(gyroscope.z, 3)} rad/s`} />
                  <MonoKV k="|w|" v={`${fmt(Math.sqrt(gyroscope.x ** 2 + gyroscope.y ** 2 + gyroscope.z ** 2), 3)} rad/s`} />
                  <ThemedText style={[styles.microHint, { color: theme.textSubtle }]}>Z yaw is fused in useCompassAccuracy for gyro versus mag divergence detection.</ThemedText>
                </>
              ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>Waiting</ThemedText>}
            </SensorBlock>

            <Pressable
              onPress={() => setExtrasEnabled((v) => !v)}
              style={[styles.extrasToggle, { backgroundColor: extrasEnabled ? theme.primary : theme.surface, borderColor: theme.divider }]}
            >
              <ThemedText style={[styles.extrasToggleText, { color: extrasEnabled ? '#fff' : theme.textMuted }]}>
                {extrasEnabled ? 'Hide battery cost sensors' : 'Show battery cost sensors (barometer, light, motion, raw mag, pedometer)'}
              </ThemedText>
            </Pressable>
            <ThemedText style={[styles.microHint, { color: theme.textSubtle }]}>
              The sensors below use extra power or require permissions. They stay off until you tap to show them.
            </ThemedText>

            {extrasEnabled && (
              <>
                <SensorBlock
                  icon="sensor.tag.radiowaves.forward"
                  title="Magnetometer (raw, uncalibrated)"
                  subtitle="microtesla, no hard iron bias removal"
                  available={isMagnetometerUncalibratedAvailable}
                  age={magnetometerUncalibrated ? ageMs(magnetometerUncalibrated.timestamp) : '-'}
                  theme={theme}
                >
                  {magnetometerUncalibrated ? (
                    <>
                      <MonoKV k="x" v={`${fmt(magnetometerUncalibrated.x, 1)} uT`} />
                      <MonoKV k="y" v={`${fmt(magnetometerUncalibrated.y, 1)} uT`} />
                      <MonoKV k="z" v={`${fmt(magnetometerUncalibrated.z, 1)} uT`} />
                      {magnetometer && <MonoKV k="delta mag" v={`${fmt(Math.abs(magnetometer.magnitude - Math.sqrt(magnetometerUncalibrated.x ** 2 + magnetometerUncalibrated.y ** 2 + magnetometerUncalibrated.z ** 2)), 1)} uT bias`} />}
                    </>
                  ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>-</ThemedText>}
                </SensorBlock>

                <SensorBlock
                  icon="barometer"
                  title="Barometer"
                  subtitle="hPa and altitude cross check"
                  available={isBarometerAvailable}
                  age={barometer ? ageMs(barometer.timestamp) : '-'}
                  theme={theme}
                >
                  {barometer ? (
                    <>
                      <MonoKV k="pressure" v={`${fmt(barometer.pressure, 1)} hPa`} accent />
                      {barometer.relativeAltitude != null && <MonoKV k="rel alt (iOS)" v={`${fmt(barometer.relativeAltitude, 1)} m`} />}
                      {baroAltitude != null && <MonoKV k="ISA alt approx" v={`${fmt(baroAltitude, 0)} m (p0 1013.25)`} />}
                      {lastLocation?.coords.altitude != null && baroAltitude != null && (
                        <MonoKV k="delta vs GPS" v={`${fmt(baroAltitude - (lastLocation.coords.altitude as number), 0)} m`} />
                      )}
                    </>
                  ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>{isBarometerAvailable === false ? 'Not available on this device' : 'Waiting'}</ThemedText>}
                </SensorBlock>

                <SensorBlock
                  icon="iphone.radiowaves.left.and.right"
                  title="Device motion"
                  subtitle="fused accel plus gyro plus orientation"
                  available={isDeviceMotionAvailable}
                  age={deviceMotion ? ageMs(deviceMotion.timestamp) : '-'}
                  theme={theme}
                >
                  {deviceMotion ? (
                    <>
                      <MonoKV k="rotation a" v={`${fmt(deviceMotion.rotation.alpha, 1)}deg`} />
                      <MonoKV k="b" v={`${fmt(deviceMotion.rotation.beta, 1)}deg`} />
                      <MonoKV k="g" v={`${fmt(deviceMotion.rotation.gamma, 1)}deg`} />
                      <MonoKV k="accel plus grav" v={`${fmt(deviceMotion.accelerationIncludingGravity.x, 2)}, ${fmt(deviceMotion.accelerationIncludingGravity.y, 2)}, ${fmt(deviceMotion.accelerationIncludingGravity.z, 2)} m/s2`} />
                      {deviceMotion.acceleration && <MonoKV k="accel" v={`${fmt(deviceMotion.acceleration.x, 2)}, ${fmt(deviceMotion.acceleration.y, 2)}, ${fmt(deviceMotion.acceleration.z, 2)} m/s2`} />}
                      {deviceMotion.rotationRate && <MonoKV k="rot rate" v={`${fmt(deviceMotion.rotationRate.alpha, 1)}, ${fmt(deviceMotion.rotationRate.beta, 1)}, ${fmt(deviceMotion.rotationRate.gamma, 1)} deg/s`} />}
                      <MonoKV k="orientation" v={`${deviceMotion.orientation}deg`} />
                      <MonoKV k="interval" v={`${deviceMotion.interval} ms`} />
                    </>
                  ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>{isDeviceMotionAvailable === false ? 'Not available' : 'Waiting'}</ThemedText>}
                </SensorBlock>

                <SensorBlock
                  icon="sun.max.fill"
                  title="Light sensor"
                  subtitle="Android only, lux"
                  available={isLightSensorAvailable}
                  age={lightSensor ? ageMs(lightSensor.timestamp) : '-'}
                  theme={theme}
                >
                  {lightSensor ? (
                    <>
                      <MonoKV k="illuminance" v={`${fmt(lightSensor.illuminance, 0)} lx`} accent />
                      <ThemedText style={[styles.microHint, { color: theme.textSubtle }]}>{lightSensor.illuminance < 10 ? 'Dark' : lightSensor.illuminance < 100 ? 'Dim indoor' : lightSensor.illuminance < 1000 ? 'Indoor or overcast' : 'Bright outdoor'}</ThemedText>
                    </>
                  ) : (
                    <ThemedText style={[styles.mono, { color: theme.textMuted }]}>
                      {isLightSensorAvailable === false
                        ? Platform.OS === 'ios' ? 'iOS does not expose ambient light. This is expected.' : 'Not available on this device'
                        : 'Waiting (cover the sensor to see change)'}
                    </ThemedText>
                  )}
                </SensorBlock>

                <SensorBlock
                  icon="figure.walk"
                  title="Pedometer"
                  subtitle="steps since midnight"
                  available={pedometerAvailable}
                  age={stepsToday != null ? 'today' : '-'}
                  theme={theme}
                >
                  {pedometerAvailable ? (
                    <>
                      <MonoKV k="steps today" v={stepsToday != null ? String(stepsToday) : '-'} accent />
                      <MonoKV k="permission" v={pedometerPerm ?? '-'} />
                      <ThemedText style={[styles.microHint, { color: theme.textSubtle }]}>Requires motion permission. On Android consider Health Connect for background counting.</ThemedText>
                    </>
                  ) : <ThemedText style={[styles.mono, { color: theme.textMuted }]}>{pedometerAvailable === false ? 'Not available on this device' : 'Checking'}</ThemedText>}
                </SensorBlock>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="map.fill" size={16} color={theme.textMuted} />
          <ThemedText style={styles.sectionTitle}>Map data and attribution</ThemedText>
        </View>
        <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider, padding: 12, gap: 8 }]}>
          <ThemedText style={[styles.text, { color: theme.textMuted, lineHeight: 18 }]}>
            CadNav renders tiles via MapTiler built from OpenStreetMap data, on a MapLibre GL renderer. Magnetic declination uses the bundled WMMHR high resolution model. All trademarks belong to their owners.
          </ThemedText>
          <LinkRow label="MapTiler" url="https://www.maptiler.com/" theme={theme} open={open} />
          <LinkRow label="OpenStreetMap contributors, ODbL" url="https://www.openstreetmap.org/copyright" theme={theme} open={open} />
          <LinkRow label="MapLibre GL (BSD 3)" url="https://maplibre.org/" theme={theme} open={open} />
          <LinkRow label="WMM, NOAA and NCEI" url="https://www.ncei.noaa.gov/products/world-magnetic-model" theme={theme} open={open} />
          <LinkRow label="MapTiler Terms of Use" url="https://www.maptiler.com/terms-of-use/" theme={theme} open={open} />
          <LinkRow label="Expo and React Native" url="https://expo.dev/" theme={theme} open={open} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="chevron.left.forwardslash.chevron.right" size={16} color={theme.textMuted} />
          <ThemedText style={styles.sectionTitle}>Source and feedback</ThemedText>
        </View>
        <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider, padding: 12, gap: 6 }]}>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2')} style={styles.linkRowPress}>
            <IconSymbol name="link" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>GitHub: Lack-Of-Name/CadNav2</ThemedText>
          </Pressable>
          <ThemedText style={[styles.mono, { color: theme.textSubtle }]}>https://github.com/Lack-Of-Name/CadNav2</ThemedText>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/issues')} style={styles.linkRowPress}>
            <IconSymbol name="exclamationmark.bubble.fill" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>Report an issue or request a feature</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/releases')} style={styles.linkRowPress}>
            <IconSymbol name="tag.fill" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>Releases and changelog</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name/CadNav2/blob/main/LICENSE')} style={styles.linkRowPress}>
            <IconSymbol name="doc.text.fill" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>License: Apache 2.0</ThemedText>
          </Pressable>
          <ThemedText style={[styles.microHint, { color: theme.textSubtle, marginTop: 4 }]}>
            Star the repo if CadNav helps you. It helps others find it. Pull requests for grid and declination fixes and offline pack improvements are welcome.
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="person.2.fill" size={16} color={theme.textMuted} />
          <ThemedText style={styles.sectionTitle}>Contributors</ThemedText>
        </View>
        <View style={[styles.kvCard, { backgroundColor: theme.surface, borderColor: theme.divider, padding: 12, gap: 6 }]}>
          <Pressable onPress={() => open('https://github.com/Lack-Of-Name')} style={styles.linkRowPress}>
            <IconSymbol name="person.fill" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>lack-of-name (Lyren): lead and maps</ThemedText>
          </Pressable>
          <Pressable onPress={() => open('https://github.com/aellul27')} style={styles.linkRowPress}>
            <IconSymbol name="person.fill" size={14} color={theme.primary} />
            <ThemedText type="link" style={styles.linkFlex}>aellul27: contributor</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.licenseBox, { borderColor: theme.divider, backgroundColor: theme.surface }]}>
        <ThemedText style={[styles.microHint, { color: theme.textSubtle, textAlign: 'center' }]}>
          2026 Lyren and contributors. Licensed under Apache 2.0. See LICENSE for full terms. Map tiles from MapTiler, data from OSM contributors, rendering by MapLibre, mag model by NOAA and NCEI.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Special thanks</ThemedText>
        <ThemedText style={[styles.text, { color: theme.textMuted }]}>You and every cadet, instructor and tester who filed a bug, suggested a waypoint, or carried CadNav into the field.</ThemedText>
      </View>
    </ThemedView>
  );
}

function KvRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  return (
    <View style={[styles.kvRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}>
      <ThemedText style={[styles.kvLabel, { color: theme.textMuted }]}>{label}</ThemedText>
      <ThemedText style={[styles.kvValue, mono && styles.mono, { color: theme.text }]} numberOfLines={2}>{value}</ThemedText>
    </View>
  );
}
function SensorBlock({ icon, title, subtitle, available, age, children, theme }: { icon: string; title: string; subtitle: string; available: boolean | null; age: string; children: React.ReactNode; theme: any }) {
  const dotColor = available === true ? theme.success : available === false ? theme.error : theme.warning;
  const dotLabel = available === true ? 'available' : available === false ? 'unavailable' : 'checking';
  return (
    <View style={[styles.sensorBlock, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <View style={styles.sensorHeader}>
        <View style={[styles.sensorIcon, { backgroundColor: theme.background }]}>
          <IconSymbol name={icon as any} size={14} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.sensorTitle}>{title}</ThemedText>
          <ThemedText style={[styles.sensorSubtitle, { color: theme.textSubtle }]} numberOfLines={2}>{subtitle}</ThemedText>
        </View>
        <View style={styles.sensorMeta}>
          <View style={[styles.availDot, { backgroundColor: dotColor }]} />
          <ThemedText style={[styles.availText, { color: theme.textMuted }]}>{dotLabel}</ThemedText>
          <ThemedText style={[styles.ageText, { color: theme.textSubtle }]}>{age}</ThemedText>
        </View>
      </View>
      <View style={[styles.sensorBody, { borderTopColor: theme.divider }]}>{children}</View>
    </View>
  );
}
function MonoKV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  return (
    <View style={styles.monoKV}>
      <ThemedText style={[styles.monoK, { color: theme.textMuted }]}>{k}</ThemedText>
      <ThemedText style={[styles.monoV, { color: accent ? theme.primary : theme.text, fontWeight: accent ? '700' as const : '400' }]}>{v}</ThemedText>
    </View>
  );
}
function Badge({ label, tone, theme }: { label: string; tone?: 'ok' | 'warning' | 'default'; theme: any }) {
  const bg = tone === 'warning' ? theme.warning + '22' : tone === 'ok' ? theme.success + '22' : theme.background;
  const fg = tone === 'warning' ? theme.warning : tone === 'ok' ? theme.success : theme.textMuted;
  const border = tone === 'warning' ? theme.warning : tone === 'ok' ? theme.success : theme.divider;
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <ThemedText style={[styles.badgeText, { color: fg }]}>{label}</ThemedText>
    </View>
  );
}
function LinkRow({ label, url, theme, open }: { label: string; url: string; theme: any; open: (u: string) => void }) {
  return (
    <Pressable onPress={() => open(url)} style={({ pressed }) => [styles.attrRow, { borderColor: theme.divider, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText style={[styles.attrLabel, { color: theme.text }]}>{label}</ThemedText>
      <ThemedText style={[styles.attrUrl, { color: theme.textSubtle }]} numberOfLines={1}>{url}</ThemedText>
      <IconSymbol name="arrow.up.right.square.fill" size={12} color={theme.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'transparent', gap: 0, paddingBottom: 8 },
  hero: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 11, marginTop: 2, lineHeight: 14 },
  ctaRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  ctaBtnText: { fontSize: 12, fontWeight: '700' },
  apiKeyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 6,
  },
  apiKeyTitle: { fontSize: 14, fontWeight: '800' },
  apiKeyDesc: { fontSize: 12, lineHeight: 16 },
  apiKeyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  apiKeyBtnText: { fontSize: 13, fontWeight: '700' },
  section: { marginTop: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  liveLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { fontSize: 11, fontWeight: '800' },
  extrasToggle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  extrasToggleText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  kvCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  kvLabel: { fontSize: 12, fontWeight: '600', flexShrink: 0 },
  kvValue: { fontSize: 12, textAlign: 'right', flex: 1 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  monoKV: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  monoK: { fontSize: 12, fontWeight: '600' },
  monoV: { fontFamily: 'monospace', fontSize: 12, textAlign: 'right', flex: 1, marginLeft: 12 },
  inlineBadgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sensorBlock: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  sensorIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorTitle: { fontSize: 13, fontWeight: '800' },
  sensorSubtitle: { fontSize: 11, lineHeight: 13 },
  sensorMeta: { alignItems: 'flex-end', gap: 2 },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  ageText: { fontSize: 10 },
  sensorBody: { padding: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 1 },
  microHint: { fontSize: 11, lineHeight: 15, marginTop: 6 },
  text: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 13, marginBottom: 6 },
  linkFlex: { fontSize: 13, flex: 1 },
  linkRowPress: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  attrLabel: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  attrUrl: { fontSize: 11, flex: 1, textAlign: 'right' },
  hint: { fontSize: 11, lineHeight: 14, marginTop: 6, marginLeft: 2 },
  licenseBox: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
  },
});
