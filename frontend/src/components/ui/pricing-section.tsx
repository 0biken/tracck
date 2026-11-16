"use client"

import * as React from "react"
import { PricingCard, type PricingTier } from "@/components/ui/pricing-card"
import { Tab } from "@/components/ui/pricing-tab"
import { cn } from "@/lib/utils"

export interface PricingSectionProps {
  title: string
  subtitle: string
  tiers: PricingTier[]
  frequencies: string[]
  className?: string
}

export function PricingSection({
  title,
  subtitle,
  tiers,
  frequencies,
  className,
}: PricingSectionProps) {
  const [selectedFrequency, setSelectedFrequency] = React.useState(frequencies[0])

  return (
    <section className={cn("flex flex-col items-center gap-10 py-10", className)}>
      <div className="space-y-7 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-medium md:text-5xl">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <div className="mx-auto flex w-fit rounded-full bg-muted p-1">
          {frequencies.map((freq) => (
            <Tab
              key={freq}
              text={freq}
              selected={selectedFrequency === freq}
              setSelected={setSelectedFrequency}
              discount={freq === "yearly"}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid w-full max-w-6xl gap-6",
          tiers.length === 2
            ? "sm:grid-cols-2 max-w-4xl"
            : tiers.length === 3
              ? "sm:grid-cols-2 lg:grid-cols-3 max-w-5xl"
              : "sm:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {tiers.map((tier) => (
          <PricingCard
            key={tier.name}
            tier={tier}
            paymentFrequency={selectedFrequency}
          />
        ))}
      </div>
    </section>
  )
}
