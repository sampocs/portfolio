import React, { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing
} from 'react-native-reanimated';

interface RollingTextProps {
  text: string;
  style?: any;
  duration?: number;
  animate?: boolean;
}

export default function RollingText({ text, style, duration = 300, animate = true }: RollingTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (text !== displayText) {
      if (!animate) {
        // No animation - just update immediately
        setDisplayText(text);
        return;
      }

      if (!isAnimating) {
        pendingTextRef.current = text;
        setIsAnimating(true);
        
        // Animate out current text
        translateY.value = withTiming(-20, { 
          duration: duration / 2, 
          easing: Easing.out(Easing.quad) 
        });
        opacity.value = withTiming(0, { 
          duration: duration / 2, 
          easing: Easing.out(Easing.quad) 
        });

        // After animation completes, update text and animate in
        setTimeout(() => {
          if (pendingTextRef.current) {
            setDisplayText(pendingTextRef.current);
            translateY.value = 20;
            opacity.value = 0;
            
            // Animate in new text
            translateY.value = withTiming(0, { 
              duration: duration / 2, 
              easing: Easing.out(Easing.quad) 
            });
            opacity.value = withTiming(1, { 
              duration: duration / 2, 
              easing: Easing.out(Easing.quad) 
            });
            
            setTimeout(() => {
              setIsAnimating(false);
              pendingTextRef.current = null;
            }, duration / 2);
          }
        }, duration / 2);
      }
    }
  }, [text, displayText, isAnimating, duration, animate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ overflow: 'hidden' }}>
      <Animated.View style={animatedStyle}>
        <Text style={style}>{displayText}</Text>
      </Animated.View>
    </View>
  );
}