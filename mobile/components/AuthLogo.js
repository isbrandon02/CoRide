import { Image, StyleSheet, View } from 'react-native';

/** Source file: project root `logo.png` — keep `mobile/assets/logo.png` in sync for Metro. */
const LOGO = require('../assets/logo.png');

const src = Image.resolveAssetSource(LOGO);
const ASPECT =
  src && src.width > 0 && src.height > 0 ? src.width / src.height : 200 / 56;

/** @param {'hero' | 'compact'} [size] — hero = large marketing lockup */
function dimensions(size) {
  const h = size === 'compact' ? 52 : 88;
  return { width: h * ASPECT, height: h };
}

export default function AuthLogo({ size = 'hero' }) {
  const dim = dimensions(size);
  return (
    <View style={[styles.wrap, size === 'compact' && styles.wrapCompact]} accessibilityRole="image">
      <Image source={LOGO} style={dim} resizeMode="contain" accessibilityLabel="CoRide" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  wrapCompact: {
    marginBottom: 12,
  },
});
