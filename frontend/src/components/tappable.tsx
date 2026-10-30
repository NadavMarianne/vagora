// A pressable area that only counts as a tap if the finger stays still.
// React Native's Pressable still fires if the finger slides around and ends on the button.
// Here, moving more than a few pixels in any direction cancels the tap, even if the finger
// comes back. Every button-like thing in the app uses this.
import { useRef } from "react";
import { type GestureResponderEvent, Pressable, type PressableProps } from "react-native";

// How far (in screen points) the finger may move and still count as a tap.
const MOVE_LIMIT = 8;

export function Tappable({ onPress, onPressIn, onTouchMove, ...props }: PressableProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        moved.current = false;
        onPressIn?.(event);
      }}
      onTouchMove={(event: GestureResponderEvent) => {
        const from = start.current;
        const { pageX, pageY } = event.nativeEvent;
        if (from && Math.hypot(pageX - from.x, pageY - from.y) > MOVE_LIMIT) moved.current = true;
        onTouchMove?.(event);
      }}
      onPress={(event) => {
        if (!moved.current) onPress?.(event);
      }}
    />
  );
}
