<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0">
      <img :src="bgImg" class="w-full h-full object-cover" />
    </div>

    <div class="absolute inset-0 bg-black/40"></div>

    <div class="relative z-10">
      <div class="relative z-10 flex min-h-screen items-top px-6 pt-20 md:px-12 md:pb-24">
        <div class="max-w-md text-white">
          <p
            class="mb-4 text-xs tracking-[0.25em] text-white/70 uppercase font-gowunbatang font-bold"
          >
            고마마정품
          </p>

          <h1 class="text-3xl font-semibold leading-relaxed md:text-5xl font-gowunbatang">
            오직 1등급<br />
            프리미엄 참외만 선별
          </h1>

          <p class="mt-5 max-w-sm text-sm leading-7 text-white/80 md:text-base font-gowunbatang">
            '고마마정품'은 직접 농사를 지어, 성주 각 공판장의<br />
            정품 시세로 정품만 선별 판매하는 1등급 참외입니다.
          </p>
        </div>
        <div class="absolute bottom-6 left-0 w-full px-6 md:px-12">
          <div
            class="mx-auto max-w-md rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-lg shadow-lg"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-white/70">카카오친구 할인</p>
                <p class="text-sm font-semibold text-white">구매하기</p>
              </div>
              <button
                class="flex h-10 w-10 items-center justify-center rounded-full border bg-white/20 text-white active:scale-90 transition"
                @click="isBuyOpen = true"
              >
                <ChevronRight class="w-6 h-6 opacity-90 active:opacity-60 transition" />
              </button>
            </div>
          </div>
        </div>
        <BaseFullOverlay v-model="isBuyOpen">
          <BuyOverlayContent
            v-if="product"
            :product="product"
            :options="productOptions"
            @submit-order="handleSubmitOrder"
          />
        </BaseFullOverlay>

        <BaseFullOverlay v-model="isCheckoutOpen">
          <CheckoutOverlayContent
            v-if="checkoutOrder"
            :order="checkoutOrder"
            @confirm-order="handleConfirmOrder"
          />
        </BaseFullOverlay>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import bgImg from '@/assets/images/gomamaLanding260323.jpg'
// import BaseBottomSheet from '@/components/overlays/BaseBottomSheet.vue'
import BaseFullOverlay from '@/components/overlays/BaseFullOverlay.vue'
import BuyOverlayContent from '@/features/buy/components/BuyOverlayContent.vue'
import { ChevronRight } from 'lucide-vue-next'
import CheckoutOverlayContent from '@/features/buy/components/CheckoutOverlayContent.vue'

const isBuyOpen = ref(false)

const product = ref(null)
const productOptions = ref([])

onMounted(async () => {
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()
  if (!productData) return

  product.value = productData

  const { data: optionData, error: optionError } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productData.id)
    .order('id', { ascending: true })
  productOptions.value = optionData || []
})

const isCheckoutOpen = ref(false)
const checkoutOrder = ref(null)

// BuyOverlayContent.vue 자식이 보낸 주문 데이터 받기
function handleSubmitOrder(orderPayload) {
  console.log('부모가 받은 주문 데이터:', orderPayload)

  checkoutOrder.value = orderPayload
  isBuyOpen.value = false
  isCheckoutOpen.value = true
}

// [이번 추가]
async function handleConfirmOrder(checkoutPayload) {
  console.log('최종 주문 데이터:', checkoutPayload)

  const { error } = await supabase.from('orders').insert([
    {
      product_id: checkoutPayload.product_id,
      product_name: checkoutPayload.product_name,
      option_id: checkoutPayload.option_id,
      option_name: checkoutPayload.option_name,
      quantity: checkoutPayload.quantity,
      total_amount: checkoutPayload.total_amount,
      recipient_name: checkoutPayload.recipient_name,
      recipient_phone: checkoutPayload.recipient_phone,
      recipient_address: checkoutPayload.recipient_address,
      delivery_message: checkoutPayload.delivery_message,
    },
  ])
  if (error) {
    console.error('주문 저장 에러:', error)
    alert('주문 저장 중 문제가 발생했습니다')
    return
  }

  console.log('주문 저장 성공')
  isCheckoutOpen.value = false
  checkoutOrder.value = null
  alert('주문이 저장되었습니다.')
}
</script>
