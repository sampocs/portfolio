import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing,
  interpolate
} from 'react-native-reanimated';

interface RollingCounterProps {
  value: number;
  style?: any;
  duration?: number;
  disableAnimation?: boolean; // Disable animation when user is interacting
}

interface DigitProps {
  digit: string;
  style?: any;
  animationProgress: Animated.SharedValue<number>;
}

// Individual digit component that animates between numbers
function AnimatedDigit({ digit, style, animationProgress }: DigitProps) {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const currentDigitIndex = digits.indexOf(digit);
  
  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animationProgress.value,
      [0, 1],
      [0, -currentDigitIndex * 44] // Assuming 44px line height from Summary component
    );
    
    return {
      transform: [{ translateY }],
    };
  });

  return (
    <View style={{ height: 44, overflow: 'hidden' }}>
      <Animated.View style={[animatedStyle, { height: 44 * 10 }]}>
        {digits.map((d, index) => (
          <Text key={index} style={[style, { height: 44, lineHeight: 44 }]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

// Component for non-animated characters (commas, periods, etc.)
function StaticChar({ char, style }: { char: string; style?: any }) {
  return (
    <Text style={[style, { height: 44, lineHeight: 44 }]}>
      {char}
    </Text>
  );
}

export default function RollingCounter({ value, style, duration = 1000, disableAnimation = false }: RollingCounterProps) {
  const animationProgress = useSharedValue(0);
  const prevValue = React.useRef(0); // Start at 0 so initial load animates properly

  // Format the number with commas and 2 decimal places (e.g., 1,234,567.89)
  const formattedValue = useMemo(() => {
    return Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [value]);

  const prevFormattedValue = useMemo(() => {
    return Math.abs(prevValue.current).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [prevValue.current]);

  // Trigger animation when value changes (only if animation not disabled)
  useEffect(() => {
    if (value !== prevValue.current) {
      if (!disableAnimation) {
        animationProgress.value = 0;
        animationProgress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        // If animation disabled, instantly show new value
        animationProgress.value = 1;
      }
      prevValue.current = value;
    }
  }, [value, duration, disableAnimation]);

  // Trigger initial animation on mount if value is not zero (only if animation not disabled)
  useEffect(() => {
    if (value !== 0 && prevValue.current === 0) {
      if (!disableAnimation) {
        animationProgress.value = 0;
        animationProgress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        animationProgress.value = 1;
      }
      prevValue.current = value;
    }
  }, []);

  // Split the formatted string into individual characters
  const characters = formattedValue.split('');
  const prevCharacters = prevFormattedValue.split('');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {characters.map((char, index) => {
        // For digits, use animated rolling counter
        if (/\d/.test(char)) {
          return (
            <AnimatedDigit
              key={`${index}-${char}`}
              digit={char}
              style={style}
              animationProgress={animationProgress}
            />
          );
        }
        
        // For non-digits (commas, etc), use static display
        return (
          <StaticChar
            key={`${index}-${char}`}
            char={char}
            style={style}
          />
        );
      })}
    </View>
  );
}