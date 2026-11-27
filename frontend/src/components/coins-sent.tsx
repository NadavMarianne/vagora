// The moment after sending coins: gold coins burst out of the middle, the amount counts up, and
// it says who got them. Tap anywhere to close; it closes by itself after a few seconds.
import { useEffect, useState } from "react";
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { GOLD } from "@/components/shine";

/** How many coins fly out, and how long it stays. */
const COINS = 14;
const STAY_MS = 4000;

export type Sent = {
    amount: number;
    currency: string;
    to: string;
    note: string;
};

export function CoinsSent({
    sent,
    onClose,
}: {
    sent: Sent | null;
    onClose: () => void;
}) {
    return (
        <Modal
            visible={sent !== null}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            {sent && <Celebration sent={sent} onClose={onClose} />}
        </Modal>
    );
}

function Celebration({ sent, onClose }: { sent: Sent; onClose: () => void }) {
    const [burst] = useState(() => new Animated.Value(0));
    const [pop] = useState(() => new Animated.Value(0));
    const [shown, setShown] = useState(0);
    // Each coin's direction and how far it flies, fixed for this moment.
    const [coins] = useState(() =>
        Array.from({ length: COINS }, (_, i) => ({
            angle: (i / COINS) * 2 * Math.PI + Math.random() * 0.4,
            reach: 110 + Math.random() * 70,
            size: 18 + Math.random() * 14,
            spin: Math.random() > 0.5 ? 1 : -1,
        })),
    );

    useEffect(() => {
        Animated.parallel([
            Animated.timing(burst, {
                toValue: 1,
                duration: 1400,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(pop, {
                toValue: 1,
                friction: 4,
                tension: 80,
                useNativeDriver: true,
            }),
        ]).start();
        // The amount counts up from 0.
        const count = new Animated.Value(0);
        const id = count.addListener(({ value }) =>
            setShown(Math.round(value)),
        );
        Animated.timing(count, {
            toValue: sent.amount,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        const timer = setTimeout(onClose, STAY_MS);
        return () => {
            count.removeListener(id);
            clearTimeout(timer);
        };
    }, [burst, pop, sent.amount, onClose]);

    return (
        <Pressable
            style={styles.screen}
            onPress={onClose}
            accessibilityLabel="Close"
        >
            <View style={styles.middle}>
                {/* A big coin pops in, and small ones burst out of it. */}
                <View style={styles.origin}>
                    {coins.map((coin, i) => {
                        const move = (to: number) =>
                            burst.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, to],
                            });
                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.coin,
                                    {
                                        width: coin.size,
                                        height: coin.size,
                                        borderRadius: coin.size / 2,
                                        opacity: burst.interpolate({
                                            inputRange: [0, 0.7, 1],
                                            outputRange: [1, 1, 0],
                                        }),
                                        transform: [
                                            {
                                                translateX: move(
                                                    Math.cos(coin.angle) *
                                                        coin.reach,
                                                ),
                                            },
                                            {
                                                translateY: move(
                                                    Math.sin(coin.angle) *
                                                        coin.reach,
                                                ),
                                            },
                                            {
                                                rotate: burst.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [
                                                        "0deg",
                                                        `${coin.spin * 540}deg`,
                                                    ],
                                                }),
                                            },
                                        ],
                                    },
                                ]}
                            />
                        );
                    })}
                    <Animated.View
                        style={[
                            styles.bigCoin,
                            { transform: [{ scale: pop }] },
                        ]}
                    >
                        <View style={styles.bigCoinInner} />
                    </Animated.View>
                </View>
                <Animated.View
                    style={[styles.card, { transform: [{ scale: pop }] }]}
                >
                    <Text style={styles.amount}>{shown.toLocaleString()}</Text>
                    <Text style={styles.currency}>{sent.currency}</Text>
                    <Text style={styles.to}>sent to {sent.to}</Text>
                    {sent.note !== "" && (
                        <Text style={styles.note}>“{sent.note}”</Text>
                    )}
                </Animated.View>
            </View>
            <Text style={styles.hint}>Tap to close</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(3,6,25,0.88)",
    },
    middle: { alignItems: "center", justifyContent: "center", gap: 20 },
    origin: {
        width: 84,
        height: 84,
        alignItems: "center",
        justifyContent: "center",
    },
    bigCoin: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: GOLD.base,
        borderWidth: 5,
        borderColor: GOLD.light,
        boxShadow: `0 0 28px ${GOLD.base}`,
    },
    bigCoinInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: GOLD.deep,
        borderStyle: "dashed",
    },
    coin: {
        position: "absolute",
        backgroundColor: GOLD.base,
        borderWidth: 3,
        borderColor: GOLD.light,
    },
    card: { alignItems: "center", gap: 4, paddingHorizontal: 24 },
    amount: {
        color: GOLD.light,
        fontSize: 64,
        fontWeight: "bold",
        fontVariant: ["tabular-nums"],
    },
    currency: { color: GOLD.base, fontSize: 22, fontWeight: "bold" },
    to: { color: "#FFFFFF", fontSize: 20, marginTop: 8 },
    note: {
        color: "#FFFFFFCC",
        fontSize: 16,
        fontStyle: "italic",
        textAlign: "center",
    },
    hint: {
        position: "absolute",
        bottom: 48,
        color: "#FFFFFF88",
        fontSize: 13,
    },
});
