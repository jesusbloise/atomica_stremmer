"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import Footer from "@/components/layout/Footer";

type Subcategory = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

type Category = {
  id: string;
  slug: string;
  label: string;
  description: string;
  cover: string;
  is_active: boolean;
  sort_order: number;
  subcategories: Subcategory[];
};

export default function AdminCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [subFormCategoryId, setSubFormCategoryId] = useState<string | null>(null);
const [newSubcategoryLabel, setNewSubcategoryLabel] = useState("");
const [creatingSubcategory, setCreatingSubcategory] = useState(false);
const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
const [editingSubcategoryLabel, setEditingSubcategoryLabel] = useState("");
const [savingSubcategory, setSavingSubcategory] = useState(false);

  const [newCategory, setNewCategory] = useState({
    label: "",
    slug: "",
    description: "",
    cover: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);

      const res = await fetch("/api/categories", {
        cache: "no-store",
      });

      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function uploadCover(file: File) {
    try {
      setUploadingCover(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/categories/cover", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error subiendo imagen");
      }

      setNewCategory((prev) => ({
        ...prev,
        cover: data.cover,
      }));
    } catch (err) {
      console.error(err);
      alert("No se pudo subir la imagen");
    } finally {
      setUploadingCover(false);
    }
  }

  async function saveCategory() {
  try {
    if (editingCategoryId) {
      setSavingEdit(true);

      const res = await fetch(`/api/categories/${editingCategoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCategory),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error actualizando categoría");
      }
    } else {
      setCreating(true);

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCategory),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error creando categoría");
      }
    }

    await loadCategories();

    setNewCategory({
      label: "",
      slug: "",
      description: "",
      cover: "",
    });

    setEditingCategoryId(null);
    setShowCategoryForm(false);
  } catch (err) {
    console.error(err);

    alert(
      err instanceof Error
        ? err.message
        : "Error guardando categoría"
    );
  } finally {
    setCreating(false);
    setSavingEdit(false);
  }
}
async function deleteCategory(id: string) {
  const ok = confirm(
    "¿Seguro que quieres eliminar esta categoría? Se ocultará del sistema, pero no se borrarán los archivos existentes."
  );

  if (!ok) return;

  try {
    const res = await fetch(`/api/categories/${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Error eliminando categoría");
    }

    await loadCategories();
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Error eliminando categoría");
  }
}
async function createSubcategory(categoryId: string) {
  try {
    setCreatingSubcategory(true);

    const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        label: newSubcategoryLabel,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Error creando subcategoría");
    }

    setNewSubcategoryLabel("");
    setSubFormCategoryId(null);
    await loadCategories();
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Error creando subcategoría");
  } finally {
    setCreatingSubcategory(false);
  }
}
async function updateSubcategory(subId: string) {
  try {
    setSavingSubcategory(true);

    const res = await fetch(`/api/subcategories/${subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editingSubcategoryLabel }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Error actualizando subcategoría");
    }

    setEditingSubcategoryId(null);
    setEditingSubcategoryLabel("");
    await loadCategories();
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Error actualizando subcategoría");
  } finally {
    setSavingSubcategory(false);
  }
}

async function deleteSubcategory(subId: string) {
  const ok = confirm("¿Seguro que quieres eliminar esta subcategoría? Se ocultará del sistema.");
  if (!ok) return;

  try {
    const res = await fetch(`/api/subcategories/${subId}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "Error eliminando subcategoría");
    }

    await loadCategories();
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : "Error eliminando subcategoría");
  }
}
  return (
    <AppShell header={<Navbar />} sidebar={<Sidebar />} footer={<Footer />}>
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-6 text-white">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Gestión de categorías
            </h1>

            <p className="text-sm text-zinc-400 mt-2">
              Administra categorías y subcategorías del sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCategoryForm((v) => !v)}
            className="shrink-0 rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold transition"
          >
            + Nueva categoría
          </button>
        </div>

        {showCategoryForm && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-xl font-semibold mb-4">
              Nueva categoría
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400">
                  Nombre
                </label>

                <input
                  type="text"
                  value={newCategory.label}
                  onChange={(e) =>
                    setNewCategory((p) => ({
                      ...p,
                      label: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  placeholder="Ej: Interno"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400">
                  Slug
                </label>

                <input
                  type="text"
                  value={newCategory.slug}
                  onChange={(e) =>
                    setNewCategory((p) => ({
                      ...p,
                      slug: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2"
                  placeholder="Ej: material-interno"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-zinc-400">
                  Descripción
                </label>

                <textarea
                  value={newCategory.description}
                  onChange={(e) =>
                    setNewCategory((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 min-h-[100px]"
                  placeholder="Descripción de la categoría..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-zinc-400 block mb-2">
                  Imagen de la categoría
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadCover(file);
                  }}
                  className="block w-full text-sm text-zinc-300"
                />

                {uploadingCover && (
                  <p className="text-sm text-orange-400 mt-2">
                    Subiendo imagen...
                  </p>
                )}

                {newCategory.cover && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700 bg-black">
                    <img
                      src={newCategory.cover}
                      alt="Vista previa"
                      className="h-48 w-full object-cover"
                    />

                    <div className="p-3">
                      <p className="text-sm font-semibold">
                        {newCategory.label || "Nombre de la categoría"}
                      </p>

                      <p className="text-xs text-zinc-400">
                        {newCategory.description || "Descripción de la categoría"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button
                type="button"
                disabled={creating || uploadingCover}
                onClick={saveCategory}
                className="rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2 text-sm font-medium"
              >
                {editingCategoryId
  ? savingEdit
    ? "Guardando..."
    : "Guardar cambios"
  : creating
    ? "Creando..."
    : "Crear categoría"}
              </button>

              <button
                type="button"
                onClick={() => setShowCategoryForm(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-zinc-400">
            Cargando categorías...
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="border border-zinc-800 rounded-2xl bg-zinc-900 overflow-hidden"
              >
                <div className="p-5 border-b border-zinc-800">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex gap-4">
                      {cat.cover && (
                        <img
                          src={cat.cover}
                          alt={cat.label}
                          className="h-20 w-32 rounded-xl object-cover border border-zinc-700"
                        />
                      )}

                      <div>
                        <h2 className="text-2xl font-semibold">
                          {cat.label}
                        </h2>

                        <p className="text-zinc-400 text-sm mt-1">
                          {cat.description}
                        </p>

                        <div className="flex gap-3 mt-3 text-xs">
                          <span className="bg-zinc-800 px-2 py-1 rounded">
                            slug: {cat.slug}
                          </span>

                          <span
                            className={`px-2 py-1 rounded ${
                              cat.is_active
                                ? "bg-green-500/20 text-green-300"
                                : "bg-red-500/20 text-red-300"
                            }`}
                          >
                            {cat.is_active ? "Activa" : "Inactiva"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
  onClick={() => {
    setEditingCategoryId(cat.id);

    setNewCategory({
      label: cat.label || "",
      slug: cat.slug || "",
      description: cat.description || "",
      cover: cat.cover || "",
    });

    setShowCategoryForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }}
  className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-sm"
>
  Editar categoría
</button>

                      <button
  onClick={() => deleteCategory(cat.id)}
  className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm"
>
  Eliminar
</button>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">
                      Subcategorías
                    </h3>

                   <button
  onClick={() => {
    setSubFormCategoryId(cat.id);
    setNewSubcategoryLabel("");
  }}
  className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm"
>
  + Nueva subcategoría
</button>
                  </div>
                  {subFormCategoryId === cat.id && (
  <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <label className="text-sm text-zinc-400">
      Nombre de la nueva subcategoría
    </label>

    <div className="mt-2 flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        value={newSubcategoryLabel}
        onChange={(e) => setNewSubcategoryLabel(e.target.value)}
        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        placeholder="Ej: Trailer, Master, Referencias..."
      />

      <button
        type="button"
        disabled={creatingSubcategory}
        onClick={() => createSubcategory(cat.id)}
        className="rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-4 py-2 text-sm"
      >
        {creatingSubcategory ? "Creando..." : "Guardar"}
      </button>

      <button
        type="button"
        onClick={() => {
          setSubFormCategoryId(null);
          setNewSubcategoryLabel("");
        }}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm"
      >
        Cancelar
      </button>
    </div>
  </div>
)}

                  <div className="flex flex-wrap gap-3">
                    {cat.subcategories.map((sub) => (
  <div
    key={sub.id}
    className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
  >
    {editingSubcategoryId === sub.id ? (
      <>
        <input
          value={editingSubcategoryLabel}
          onChange={(e) => setEditingSubcategoryLabel(e.target.value)}
          className="w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
        />

        <button
          type="button"
          disabled={savingSubcategory}
          onClick={() => updateSubcategory(sub.id)}
          className="text-xs text-green-300 hover:text-green-200"
        >
          Guardar
        </button>

        <button
          type="button"
          onClick={() => {
            setEditingSubcategoryId(null);
            setEditingSubcategoryLabel("");
          }}
          className="text-xs text-zinc-400 hover:text-white"
        >
          Cancelar
        </button>
      </>
    ) : (
      <>
        <span>{sub.label}</span>

        <button
          type="button"
          onClick={() => {
            setEditingSubcategoryId(sub.id);
            setEditingSubcategoryLabel(sub.label);
          }}
          className="text-xs text-orange-300 hover:text-orange-200"
        >
          Editar
        </button>

        <button
          type="button"
          onClick={() => deleteSubcategory(sub.id)}
          className="text-xs text-red-300 hover:text-red-200"
        >
          Eliminar
        </button>
      </>
    )}
  </div>
))}

                    {cat.subcategories.length === 0 && (
                      <p className="text-sm text-zinc-500">
                        Sin subcategorías.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}