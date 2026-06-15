from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class PlanFeature(BaseModel):
    name_ml: str
    free: bool
    pro: bool


class PricingResponse(BaseModel):
    currency: str
    monthly_inr: int
    yearly_inr: int
    features: list[PlanFeature]


class CheckoutRequest(BaseModel):
    plan: str = "pro"
    interval: str = "monthly"  # monthly | yearly
    provider: str = "razorpay"  # razorpay | stripe
    coupon: str | None = None


class CheckoutResponse(BaseModel):
    provider: str
    order_id: str
    amount: int
    currency: str
    key_id: str | None


@router.get("/pricing", response_model=PricingResponse)
async def pricing():
    features = [
        PlanFeature(name_ml="ദിവസേന വിശകലനങ്ങൾ", free=True, pro=True),
        PlanFeature(name_ml="പരിധിയില്ലാത്ത വിശകലനം", free=False, pro=True),
        PlanFeature(name_ml="മലയാളം AI വിശദീകരണം", free=True, pro=True),
        PlanFeature(name_ml="വോയ്സ് വിശദീകരണം", free=False, pro=True),
        PlanFeature(name_ml="ഓപ്പണിംഗ് കോഴ്സുകൾ", free=False, pro=True),
        PlanFeature(name_ml="വിശദമായ ഇൻസൈറ്റുകൾ", free=False, pro=True),
    ]
    return PricingResponse(
        currency="INR", monthly_inr=199, yearly_inr=1499, features=features
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(body: CheckoutRequest, user: User = Depends(get_current_user)):
    """Create a payment order.

    This is a stub that returns a deterministic order so the frontend flow can
    be wired end to end. Replace with real Razorpay/Stripe SDK calls and verify
    webhooks server-side before activating the subscription.
    """
    amount = 1499 if body.interval == "yearly" else 199
    if body.coupon:  # naive coupon hook; real validation lives in a CouponService
        amount = int(amount * 0.8)
    order_id = f"order_{user.id}_{body.interval}"
    key_id = (
        settings.RAZORPAY_KEY_ID
        if body.provider == "razorpay"
        else settings.STRIPE_SECRET_KEY[:8]
    )
    return CheckoutResponse(
        provider=body.provider,
        order_id=order_id,
        amount=amount * 100,  # smallest currency unit
        currency="INR",
        key_id=key_id or None,
    )
