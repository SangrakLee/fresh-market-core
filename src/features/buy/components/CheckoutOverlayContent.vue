<template>
  <div class="min-h-full bg-white px-5 pt-5 pb-32 text-black">
    <!-- 주문 요약 -->
    <div class="mb-6">
      <p class="mb-1 text-xs text-black/50">주문 상품</p>
      <h2 class="text-xl font-semibold">{{ order.product_name }}</h2>
      <p class="mt-2 text-sm text-black/70">{{ order.option_name }} · {{ order.quantity }}개</p>
    </div>

    <!-- 총 금액 -->
    <div class="mb-8 rounded-2xl bg-black/[0.04] p-4">
      <p class="text-sm text-black/60">총 금액</p>
      <strong class="mt-1 block text-2xl font-semibold">
        {{ order.total_amount.toLocaleString() }}원
      </strong>
    </div>

    <!-- 주문자 정보 -->
    <div class="space-y-4">
      <div>
        <label class="mb-2 block text-sm font-medium">받는 분 이름</label>
        <input
          v-model="form.recipient_name"
          type="text"
          class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="이름 입력"
        />
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium">연락처</label>
        <input
          v-model="form.recipient_phone"
          type="text"
          class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="연락처 입력"
        />
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium">주소</label>
        <input
          v-model="form.recipient_address"
          type="text"
          class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="주소 입력"
        />
      </div>

      <div>
        <label class="mb-2 block text-sm font-medium">배송 메모</label>
        <textarea
          v-model="form.delivery_message"
          rows="4"
          class="w-full resize-none rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="배송 시 요청사항 입력"
        ></textarea>
      </div>
      <p v-if="errorMessage" class="mt-4 text-sm font-medium text-red-500">{{ errorMessage }}</p>
    </div>

    <!-- 하단 고정 CTA -->
    <div
      class="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-[375px] rounded-t-3xl border-t border-black/10 bg-white px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        @click="handleConfirmOrder"
        class="w-full rounded-2xl bg-[#22d3c5] px-5 py-4 text-base font-semibold text-black active:scale-[0.98] transition"
      >
        {{ order.total_amount.toLocaleString() }}원 주문하기
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

// 부모에서 주문 데이터 받기
const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
})

// 부모로 최종 주문 데이터 전달
const emit = defineEmits(['confirm-order'])

// 체크아웃 폼 상태
const form = reactive({
  recipient_name: '',
  recipient_phone: '',
  recipient_address: '',
  delivery_message: '',
})

// 주문 확인 클릭
const errorMessage = ref('')

function handleConfirmOrder() {
  const recipientName = form.recipient_name.trim()
  const recipientPhone = form.recipient_phone.trim()
  const recipientAddress = form.recipient_address.trim()
  const deliveryMessage = form.delivery_message.trim()

  if (!recipientName) {
    errorMessage.value = '받는 분 이름을 입력해 주세요.'
    return
  }

  if (!recipientPhone) {
    errorMessage.value = '연락처를 입력해 주세요.'
    return
  }

  if (!recipientAddress) {
    errorMessage.value = '주소를 입력해 주세요.'
    return
  }

  errorMessage.value = ''

  const checkoutPayload = {
    ...props.order,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address: recipientAddress,
    delivery_message: deliveryMessage,
  }

  console.log('checkoutPayload:', checkoutPayload)
  emit('confirm-order', checkoutPayload)
}
</script>
