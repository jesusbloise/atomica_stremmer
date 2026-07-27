"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Search,
  X,
} from "lucide-react";

type CreatableComboboxProps = {
  label: string;
  value?: string | null;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

export default function CreatableCombobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Buscar o escribir...",
  disabled = false,
}: CreatableComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentValue = value ?? "";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(currentValue);

  useEffect(() => {
    setSearch(currentValue);
  }, [currentValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch(currentValue);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentValue]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSearch(currentValue);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [currentValue]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalize(search);

    const unique = new Map<string, string>();

    for (const option of options) {
      const cleaned = option.trim();

      if (!cleaned) continue;

      const key = normalize(cleaned);

      if (!unique.has(key)) {
        unique.set(key, cleaned);
      }
    }

    return Array.from(unique.values()).filter((option) => {
      if (!normalizedSearch) return true;

      return normalize(option).includes(normalizedSearch);
    });
  }, [options, search]);

  const exactMatch = options.some(
    (option) => normalize(option) === normalize(search)
  );

  const canCreate = search.trim().length > 0 && !exactMatch;

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setSearch(nextValue);
    setOpen(false);
  }

  function clearValue() {
    onChange("");
    setSearch("");
    setOpen(false);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  return (
    <div ref={containerRef} className="relative flex flex-col">
      <label className="text-zinc-500 text-[11px]">
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;

            setSearch(nextValue);
            onChange(nextValue);
            setOpen(true);
          }}
          className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 pr-16 text-[13px] text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/70 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="absolute inset-y-0 right-1 flex items-center">
          {currentValue ? (
            <button
              type="button"
              onClick={clearValue}
              disabled={disabled}
              aria-label={`Limpiar ${label}`}
              title={`Limpiar ${label}`}
              className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-700 hover:text-white disabled:pointer-events-none"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <button
            type="button"
            disabled={disabled}
            aria-label={`Abrir opciones de ${label}`}
            title={`Abrir opciones de ${label}`}
            onClick={() => {
              setOpen((current) => !current);

              requestAnimationFrame(() => {
                inputRef.current?.focus();
              });
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-700 hover:text-white disabled:pointer-events-none"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-zinc-500">
            <Search className="h-4 w-4 shrink-0" />

            <span className="truncate text-xs">
              Selecciona una opción o escribe una nueva
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filteredOptions.map((option) => {
              const selected =
                normalize(option) === normalize(currentValue);

              return (
                <button
                  key={normalize(option)}
                  type="button"
                  onClick={() => selectValue(option)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected ? (
                      <Check className="h-4 w-4 text-orange-400" />
                    ) : null}
                  </span>

                  <span className="truncate">{option}</span>
                </button>
              );
            })}

            {canCreate ? (
              <>
                {filteredOptions.length > 0 ? (
                  <div className="my-1 border-t border-zinc-800" />
                ) : null}

                <button
                  type="button"
                  onClick={() => selectValue(search.trim())}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-orange-300 transition hover:bg-orange-500/10"
                >
                  <Plus className="h-4 w-4 shrink-0" />

                  <span className="truncate">
                    Usar “{search.trim()}”
                  </span>
                </button>
              </>
            ) : null}

            {filteredOptions.length === 0 && !canCreate ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                No hay opciones disponibles.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}