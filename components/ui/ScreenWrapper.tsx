import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  StatusBar,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { colors } from '../../theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  bg?: string;
  keyboardOffset?: number;
}

export default function ScreenWrapper({
  children,
  scroll = false,
  keyboard = false,
  edges = ['top', 'left', 'right'],
  style,
  contentStyle,
  bg = colors.bg.canvas,
  keyboardOffset = 0,
}: Props) {
  // scroll + keyboard: use KeyboardAwareScrollView — handles all focus/scroll logic automatically
  if (scroll && keyboard) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }, style]} edges={edges}>
        <StatusBar barStyle="light-content" backgroundColor={bg} />
        <KeyboardAwareScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          enableOnAndroid
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  const content = scroll ? (
    <KeyboardAwareScrollView
      style={styles.fill}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <View style={[styles.fill, contentStyle]}>{children}</View>
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      {content}
    </KeyboardAvoidingView>
  ) : content;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }, style]} edges={edges}>
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
