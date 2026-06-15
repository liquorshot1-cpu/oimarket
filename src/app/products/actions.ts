"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CATEGORIES } from "@/app/products/categories";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// 카테고리·가격 파싱 (등록과 수정에서 공통으로 사용)
function parseProductFields(formData: FormData) {
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const location = getString(formData, "location");

  const categoryInput = getString(formData, "category");
  const category = (CATEGORIES as readonly string[]).includes(categoryInput)
    ? categoryInput
    : "기타";

  const isFree = formData.get("isFree") === "on";
  const priceRaw = getString(formData, "price").replace(/[^0-9]/g, "");
  const price = isFree ? 0 : priceRaw ? parseInt(priceRaw, 10) : 0;

  return { title, description, location, category, price };
}

// ── 판매글 등록 ──
export async function createProduct(formData: FormData) {
  const { title, description, location, category, price } =
    parseProductFields(formData);

  if (!title) {
    redirect("/sell?error=" + encodeURIComponent("상품 이름을 입력해 주세요."));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      "/login?message=" + encodeURIComponent("상품을 등록하려면 먼저 로그인해 주세요. 🌱"),
    );
  }

  const { error } = await supabase.from("products").insert({
    title,
    description: description || null,
    price,
    category,
    location: location || null,
    user_id: user.id,
  });

  if (error) {
    redirect("/sell?error=" + encodeURIComponent("등록 실패: " + error.message));
  }

  revalidatePath("/", "layout");
  redirect("/?registered=1");
}

// ── 판매글 수정 ──
export async function updateProduct(id: string, formData: FormData) {
  const { title, description, location, category, price } =
    parseProductFields(formData);

  if (!title) {
    redirect(
      `/products/${id}/edit?error=` + encodeURIComponent("상품 이름을 입력해 주세요."),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?message=" + encodeURIComponent("로그인이 필요해요. 🌱"));
  }

  // RLS가 DB에서도 막아주지만, 코드에서도 본인 글만 수정하도록 명시합니다.
  const { error } = await supabase
    .from("products")
    .update({
      title,
      description: description || null,
      price,
      category,
      location: location || null,
    })
    .eq("id", id)
    .eq("user_id", user.id); // ← 코드 레벨 2중 차단

  if (error) {
    redirect(
      `/products/${id}/edit?error=` + encodeURIComponent("수정 실패: " + error.message),
    );
  }

  revalidatePath("/products", "layout");
  redirect(`/products/${id}?updated=1`);
}

// ── 판매글 삭제 ──
export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?message=" + encodeURIComponent("로그인이 필요해요. 🌱"));
  }

  // RLS + 코드 2중 차단
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(
      `/products/${id}?error=` + encodeURIComponent("삭제 실패: " + error.message),
    );
  }

  revalidatePath("/products", "layout");
  redirect("/products?deleted=1");
}
