"use client";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TipoRelatorio } from "@/server/relatorios";

interface ExportButtonProps {
  tipo: TipoRelatorio;
  mes: number;
  ano: number;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  showPrint?: boolean;
}

/**
 * Botão de exportação rápida — gera CSV do relatório indicado.
 * Quando showPrint=true, mostra um botão extra que abre a versão imprimível
 * em /relatorios?tipo=... para o usuário fazer "Salvar como PDF".
 */
export function ExportButton({
  tipo,
  mes,
  ano,
  label = "Exportar CSV",
  variant = "outline",
  size = "sm",
  showPrint,
}: ExportButtonProps) {
  function baixarCSV() {
    window.location.href = `/api/relatorios?tipo=${tipo}&mes=${mes}&ano=${ano}&formato=csv`;
  }
  function abrirImpressao() {
    const url = `/relatorios?tipo=${tipo}&mes=${mes}&ano=${ano}`;
    window.open(url, "_blank");
  }
  return (
    <div className="inline-flex gap-2">
      <Button variant={variant} size={size} onClick={baixarCSV}>
        <Download className="h-4 w-4" />
        {label}
      </Button>
      {showPrint && (
        <Button variant="ghost" size={size} onClick={abrirImpressao}>
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      )}
    </div>
  );
}
