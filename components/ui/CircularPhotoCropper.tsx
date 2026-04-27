import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { spacing } from '../../theme';

const SCREEN = Dimensions.get('window');
const CIRCLE_SIZE = Math.round(Math.min(SCREEN.width, SCREEN.height) * 0.76);
const RADIUS = CIRCLE_SIZE / 2;
const BUTTON_BAR_H = 120;

interface Props {
  uri: string;
  onCrop: (uri: string) => void;
  onCancel: () => void;
}

export default function CircularPhotoCropper({ uri, onCrop, onCancel }: Props) {
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [container, setContainer] = useState({ w: SCREEN.width, h: SCREEN.height });
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    Image.getSize(uri, (w, h) => setImgNatural({ w, h }), () => setImgNatural({ w: 1, h: 1 }));
  }, [uri]);

  // Scale the image so its shorter dimension fills the circle
  const imgAspect = imgNatural ? imgNatural.w / imgNatural.h : 1;
  const displayW = imgAspect >= 1 ? CIRCLE_SIZE * imgAspect : CIRCLE_SIZE;
  const displayH = imgAspect >= 1 ? CIRCLE_SIZE : CIRCLE_SIZE / imgAspect;

  // Animated transform values
  const animTx = useRef(new Animated.Value(0)).current;
  const animTy = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;

  // Accumulated state refs (avoid stale closures in PanResponder)
  const acc = useRef({ tx: 0, ty: 0, scale: 1 });
  const gestureStart = useRef({ tx: 0, ty: 0 });
  const pinchRef = useRef({ active: false, initDist: 0, initScale: 1 });

  const clampTx = (tx: number, s: number) => {
    const max = Math.max(0, (displayW * s - CIRCLE_SIZE) / 2);
    return Math.max(-max, Math.min(max, tx));
  };
  const clampTy = (ty: number, s: number) => {
    const max = Math.max(0, (displayH * s - CIRCLE_SIZE) / 2);
    return Math.max(-max, Math.min(max, ty));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        gestureStart.current = { tx: acc.current.tx, ty: acc.current.ty };
        pinchRef.current = { active: false, initDist: 0, initScale: acc.current.scale };
      },

      onPanResponderMove: (evt, gs) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (!pinchRef.current.active) {
            pinchRef.current = { active: true, initDist: dist, initScale: acc.current.scale };
            return;
          }

          const newScale = Math.max(1, Math.min(5, pinchRef.current.initScale * (dist / pinchRef.current.initDist)));
          acc.current.scale = newScale;
          animScale.setValue(newScale);

          // Re-clamp translation on scale change
          const tx = clampTx(acc.current.tx, newScale);
          const ty = clampTy(acc.current.ty, newScale);
          acc.current.tx = tx;
          acc.current.ty = ty;
          animTx.setValue(tx);
          animTy.setValue(ty);
        } else {
          if (pinchRef.current.active) {
            // Switched from pinch to pan — reset gesture origin
            pinchRef.current.active = false;
            gestureStart.current = { tx: acc.current.tx, ty: acc.current.ty };
            return;
          }
          const tx = clampTx(gestureStart.current.tx + gs.dx, acc.current.scale);
          const ty = clampTy(gestureStart.current.ty + gs.dy, acc.current.scale);
          animTx.setValue(tx);
          animTy.setValue(ty);
        }
      },

      onPanResponderRelease: (_, gs) => {
        if (!pinchRef.current.active) {
          acc.current.tx = clampTx(gestureStart.current.tx + gs.dx, acc.current.scale);
          acc.current.ty = clampTy(gestureStart.current.ty + gs.dy, acc.current.scale);
          animTx.setValue(acc.current.tx);
          animTy.setValue(acc.current.ty);
        }
        pinchRef.current.active = false;
      },
    })
  ).current;

  const handleCrop = useCallback(async () => {
    if (!imgNatural) return;
    setCropping(true);
    try {
      const { tx, ty, scale: s } = acc.current;

      // Image origin (top-left) in container coords at current transform
      const imgOriginX = (container.w - displayW * s) / 2 + tx;
      const imgOriginY = (container.h - displayH * s) / 2 + ty;

      // Circle top-left in container coords
      const circleLeft = (container.w - CIRCLE_SIZE) / 2;
      const circleTop  = (container.h - CIRCLE_SIZE) / 2;

      // Offset of circle within the (scaled) image, in display points
      const relLeft = circleLeft - imgOriginX;
      const relTop  = circleTop  - imgOriginY;

      // Convert to natural image pixels (uniform ratio since aspect is preserved)
      const pxPerPt = imgNatural.w / (displayW * s);
      const originX = Math.max(0, Math.round(relLeft * pxPerPt));
      const originY = Math.max(0, Math.round(relTop  * pxPerPt));
      const cropPx  = Math.round(CIRCLE_SIZE * pxPerPt);
      const safeW   = Math.min(imgNatural.w - originX, cropPx);
      const safeH   = Math.min(imgNatural.h - originY, cropPx);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX, originY, width: safeW, height: safeH } },
          { resize: { width: 400, height: 400 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      onCrop(result.uri);
    } catch {
      onCrop(uri); // fallback: upload original
    } finally {
      setCropping(false);
    }
  }, [uri, imgNatural, displayW, displayH, container, onCrop]);

  const circleTop  = (container.h - CIRCLE_SIZE) / 2;
  const circleSide = (container.w - CIRCLE_SIZE) / 2;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View
        style={styles.root}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setContainer({ w: width, h: height });
        }}
      >
        {!imgNatural ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <>
            {/* Pannable / zoomable image */}
            <Animated.Image
              source={{ uri }}
              style={{
                position: 'absolute',
                width: displayW,
                height: displayH,
                transform: [
                  { translateX: animTx },
                  { translateY: animTy },
                  { scale: animScale },
                ],
              }}
              resizeMode="cover"
            />

            {/* Dark overlay — 4 rects around the circle */}
            <View pointerEvents="none" style={[styles.overlay, { top: 0, left: 0, right: 0, height: circleTop }]} />
            <View pointerEvents="none" style={[styles.overlay, { top: circleTop + CIRCLE_SIZE, left: 0, right: 0, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.overlay, { top: circleTop, left: 0, width: circleSide, height: CIRCLE_SIZE }]} />
            <View pointerEvents="none" style={[styles.overlay, { top: circleTop, right: 0, width: circleSide, height: CIRCLE_SIZE }]} />

            {/* Circle border ring */}
            <View
              pointerEvents="none"
              style={[
                styles.circleBorder,
                { width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: RADIUS, top: circleTop, left: circleSide },
              ]}
            />

            {/* Hint */}
            <View pointerEvents="none" style={[styles.hintWrap, { top: circleTop - 48 }]}>
              <Text style={styles.hint}>Pinch to zoom  ·  Drag to reposition</Text>
            </View>

            {/* Gesture capture layer — sits above overlays, below buttons */}
            <View
              {...panResponder.panHandlers}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: BUTTON_BAR_H }}
            />

            {/* Action bar */}
            <View style={[styles.actionBar, { paddingBottom: Platform.OS === 'ios' ? 40 : 20 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chooseBtn, cropping && styles.chooseBtnDim]}
                onPress={handleCrop}
                disabled={cropping}
                activeOpacity={0.85}
              >
                {cropping
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.chooseText}>Choose</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  circleBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BUTTON_BAR_H,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    fontWeight: '400',
  },
  chooseBtn: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    minWidth: 100,
    alignItems: 'center',
  },
  chooseBtnDim: { opacity: 0.65 },
  chooseText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '600',
  },
});
