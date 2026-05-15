"use client";
import * as React from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number;
  onChange: (val: number) => void;
}

function formatTyping(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return (
    sign +
    reais.toLocaleString("pt-BR") +
    "," +
    centavos.toString().padStart(2, "0")
  );
}

export function MoneyInput({
  value,
  onChange,
  className,
  ...rest
}: MoneyInputProps) {
  const cents = Math.round(value * 100);
  const display = formatTyping(cents);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const c = digits === "" ? 0 : parseInt(digits, 10);
    onChange(c / 100);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className={cn("pl-10", className)}
        {...rest}
      />
    </div>
  );
}
