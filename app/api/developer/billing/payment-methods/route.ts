import { NextRequest, NextResponse } from "next/server";
import { getDeveloperUser, getClientIp } from "@/lib/server/developerAuth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

/**
 * GET /api/developer/billing/payment-methods
 * Lists all registered payment methods for the authenticated developer.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: paymentMethods, error } = await supabaseAdmin
      .from("payment_methods")
      .select("id, provider, provider_customer_id, card_brand, card_last4, is_default, created_at, updated_at")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !paymentMethods) {
      console.error("Fetch payment methods error:", error);
      return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paymentMethods,
    });
  } catch (error) {
    console.error("GET payment methods error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/developer/billing/payment-methods
 * Creates/Registers a new payment method for the developer.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      provider,
      provider_customer_id,
      card_brand,
      card_last4,
      is_default = false,
    } = body as {
      provider?: string;
      provider_customer_id?: string;
      card_brand?: string;
      card_last4?: string;
      is_default?: boolean;
    };

    if (!provider || !provider_customer_id) {
      return NextResponse.json(
        { error: "Missing required fields: provider, provider_customer_id" },
        { status: 400 }
      );
    }

    // If this payment method is set to default, unset other defaults first
    if (is_default) {
      const { error: resetError } = await supabaseAdmin
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", user.id);

      if (resetError) {
        console.warn("Failed to reset existing default payment methods:", resetError);
      }
    }

    // Insert the new payment method
    const { data: newPaymentMethod, error: insertError } = await supabaseAdmin
      .from("payment_methods")
      .insert({
        user_id: user.id,
        provider,
        provider_customer_id,
        card_brand: card_brand || null,
        card_last4: card_last4 || null,
        is_default,
      })
      .select("id, provider, provider_customer_id, card_brand, card_last4, is_default, created_at")
      .single();

    if (insertError || !newPaymentMethod) {
      console.error("Insert payment method error:", insertError);
      return NextResponse.json({ error: "Failed to add payment method" }, { status: 500 });
    }

    // Log the audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "billing.payment_method.add",
      metadata: { payment_method_id: newPaymentMethod.id, provider },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      paymentMethod: newPaymentMethod,
    }, { status: 201 });
  } catch (error) {
    console.error("POST payment method error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/developer/billing/payment-methods?id=...
 * Removes a payment method, ensuring ownership check.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getDeveloperUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("id");

    if (!paymentMethodId) {
      return NextResponse.json({ error: "Missing query parameter: id" }, { status: 400 });
    }

    // Verify ownership
    const { data: pm, error: fetchError } = await supabaseAdmin
      .from("payment_methods")
      .select("id, user_id")
      .eq("id", paymentMethodId)
      .maybeSingle();

    if (fetchError || !pm) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    if (pm.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden. Ownership mismatch." }, { status: 403 });
    }

    // Delete the payment method
    const { error: deleteError } = await supabaseAdmin
      .from("payment_methods")
      .delete()
      .eq("id", paymentMethodId);

    if (deleteError) {
      console.error("Delete payment method error:", deleteError);
      return NextResponse.json({ error: "Failed to remove payment method" }, { status: 500 });
    }

    // Log audit event
    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "billing.payment_method.delete",
      metadata: { payment_method_id: paymentMethodId },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      message: "Payment method removed successfully",
    });
  } catch (error) {
    console.error("DELETE payment method error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
