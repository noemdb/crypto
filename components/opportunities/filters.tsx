"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  X, 
  Filter, 
  ArrowUpDown,
  TrendingUp,
  History,
  Target
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

const ASSETS = ["ALL", "USDT", "USDC", "BTC", "ETH", "VES"] as const;
const CLASSIFICATIONS = ["ALL", "EXECUTABLE", "MARGINAL", "INVALID"] as const;
const SORT_OPTIONS = [
  { label: "Fecha", value: "evaluatedAt" },
  { label: "ROI", value: "roiAdjusted" },
  { label: "Probabilidad", value: "fillProbability" },
];

export function OpportunitiesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 300);

  const activeAsset = searchParams.get("asset") || "ALL";
  const activeClass = searchParams.get("classification") || "ALL";
  const sortBy = searchParams.get("sortBy") || "evaluatedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "ALL" || !value) {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleUpdate = (name: string, value: string) => {
    router.push(`?${createQueryString(name, value)}`, { scroll: false });
  };

  useEffect(() => {
    handleUpdate("search", debouncedSearch);
  }, [debouncedSearch]);

  const toggleSortOrder = () => {
    handleUpdate("sortOrder", sortOrder === "desc" ? "asc" : "desc");
  };

  const clearFilters = () => {
    router.push("/dashboard/opportunities", { scroll: false });
    setSearch("");
  };

  const hasActiveFilters = search || activeAsset !== "ALL" || activeClass !== "ALL" || sortBy !== "evaluatedAt";

  return (
    <div className="space-y-4 p-4 rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por plataforma o ruta..."
            className="pl-9 pr-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-accent text-muted-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ordenar por */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Ordenar
            </span>
            <select
              value={sortBy}
              onChange={(e) => handleUpdate("sortBy", e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer py-1"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSortOrder}
            >
              <ArrowUpDown className={cn("h-3.5 w-3.5 transition-transform", sortOrder === "asc" ? "rotate-180" : "")} />
            </Button>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs h-9 gap-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        {/* Clasificación */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Estado
          </span>
          <div className="flex gap-1 p-1 rounded-lg border bg-background shadow-sm">
            {CLASSIFICATIONS.map((c) => (
              <button
                key={c}
                onClick={() => handleUpdate("classification", c)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  activeClass === c
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                {c === "ALL" ? "Todos" : c}
              </button>
            ))}
          </div>
        </div>

        {/* Assets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Moneda
          </span>
          <div className="flex gap-1 p-1 rounded-lg border bg-background shadow-sm">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => handleUpdate("asset", a)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  activeAsset === a
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                {a === "ALL" ? "Todas" : a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
