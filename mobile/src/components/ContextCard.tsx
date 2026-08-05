import { Pressable, Text, View } from "react-native";
import { Body, Heading } from "@/components/Text";
import { colors } from "@/theme/colors";
import type { PersonalContextCard } from "@/types/personalIntelligence";

type Props = {
  card: PersonalContextCard;
  featured?: boolean;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
};

const iconLabels: Record<PersonalContextCard["icon"], string> = {
  wallet: "Wallet",
  location: "Nearby",
  plan: "Plan",
  coach: "Coach",
  spark: "Smart",
  progress: "Progress",
  pay: "Pay",
};

export function ContextCard({
  card,
  featured = false,
  onPrimaryPress,
  onSecondaryPress,
}: Props) {
  return (
    <View
      accessibilityLabel={`${card.title} ${card.explanation}`}
      style={{
        backgroundColor: featured ? "rgba(56, 189, 248, 0.14)" : colors.panel,
        borderColor: featured ? "rgba(56, 189, 248, 0.36)" : "rgba(148, 163, 184, 0.14)",
        borderRadius: featured ? 32 : 24,
        borderWidth: 1,
        gap: 16,
        padding: featured ? 22 : 18,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            alignItems: "center",
            backgroundColor: featured ? colors.cyan : colors.card,
            borderRadius: 18,
            height: 44,
            justifyContent: "center",
            width: 44,
          }}
        >
          <Text style={{ color: featured ? colors.ink : colors.text, fontWeight: "900" }}>
            {iconLabels[card.icon].slice(0, 1)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Heading style={{ fontSize: featured ? 24 : 19 }}>{card.title}</Heading>
          <Body>{card.explanation}</Body>
          {card.metadata?.valueLabel ? (
            <Text style={{ color: colors.gold, fontSize: 15, fontWeight: "900" }}>
              {card.metadata.valueLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <ContextButton
          title={card.primaryActionLabel}
          featured={featured}
          onPress={onPrimaryPress}
        />
        {card.secondaryActionLabel && onSecondaryPress ? (
          <ContextButton
            title={card.secondaryActionLabel}
            featured={false}
            onPress={onSecondaryPress}
          />
        ) : null}
      </View>
    </View>
  );
}

function ContextButton({
  title,
  featured,
  onPress,
}: {
  title: string;
  featured: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: featured ? colors.cyan : colors.card,
        borderRadius: 999,
        minHeight: 44,
        opacity: pressed ? 0.78 : 1,
        paddingHorizontal: 16,
        paddingVertical: 11,
      })}
    >
      <Text
        style={{
          color: featured ? colors.ink : colors.text,
          fontSize: 15,
          fontWeight: "900",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
