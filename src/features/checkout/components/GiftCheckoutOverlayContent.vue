<template>
  <div class="min-h-full bg-white px-5 pt-5 pb-32 text-black">
    <div class="mb-6">
      <p class="mb-1 text-xs text-black/50">선물 상품</p>
      <h2 class="text-xl font-semibold">{{ order.product_name }}</h2>
      <p class="mt-2 text-sm text-black/70">{{ order.option_name }} · {{ order.quantity }}개</p>
    </div>

    <div class="mb-6 rounded-2xl bg-black/[0.04] p-4">
      <p class="text-sm text-black/60">총 금액</p>
      <strong class="mt-1 block text-2xl font-semibold"
        >{{ order.total_amount.toLocaleString() }}원</strong
      >
    </div>

    <div class="mb-6">
      <label class="mb-2 block text-sm font-medium">배송지 수</label>
      <select
        v-model.number="addressCount"
        class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
      >
        <option v-for="count in maxAddressCount" :key="count" :value="count">{{ count }}곳</option>
      </select>
      <p class="mt-2 text-xs text-black/50">
        주문 수량 {{ order.quantity }}개 기준 최대 {{ maxAddressCount }}곳 · 본인 주소 없이 전부
        선물 배송 가능
      </p>
    </div>

    <div class="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
      본인 주소를 입력하지 않고, 선택한 배송지들로만 전량 선물 주문할 수 있어요.
    </div>

    <div class="space-y-5">
      <div
        v-for="(recipient, index) in recipients"
        :key="index"
        class="rounded-2xl border border-black/10 p-4"
      >
        <h3 class="mb-3 text-sm font-semibold">배송지 {{ index + 1 }}</h3>
        <div class="space-y-3">
          <input
            v-model="recipient.name"
            type="text"
            class="w-full rounded-2xl border border-black/10 px-4 py-3"
            placeholder="받는 분 이름"
          />
          <input
            :value="recipient.phone"
            @input="(e) => handlePhoneInput(e, index)"
            type="tel"
            maxlength="13"
            class="w-full rounded-2xl border border-black/10 px-4 py-3"
            placeholder="010-1234-5678"
          />
          <input
            v-model="recipient.address"
            type="text"
            class="w-full rounded-2xl border border-black/10 px-4 py-3"
            placeholder="주소 입력"
          />
          <input
            v-model="recipient.detailAddress"
            type="text"
            class="w-full rounded-2xl border border-black/10 px-4 py-3"
            placeholder="상세주소 입력"
          />
          <textarea
            v-model="recipient.deliveryMessage"
            rows="2"
            class="w-full resize-none rounded-2xl border border-black/10 px-4 py-3"
            placeholder="배송 메모"
          ></textarea>
        </div>
      </div>
      <p v-if="errorMessage" class="text-sm font-medium text-red-500">{{ errorMessage }}</p>
    </div>

    <div
      class="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-[375px] rounded-t-3xl border-t border-black/10 bg-white px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        @click="handleConfirmGiftOrder"
        :disabled="props.isSubmitting"
        :class="[
          'w-full rounded-2xl px-5 py-4 text-base font-semibold transition',
          props.isSubmitting
            ? 'bg-black/20 text-black/40 cursor-not-allowed'
            : 'bg-[#22d3c5] text-black',
        ]"
      >
        {{
          props.isSubmitting
            ? '주문 저장 중...'
            : `${order.total_amount.toLocaleString()}원 선물하기`
        }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  order: { type: Object, required: true },
  isSubmitting: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm-order'])
const maxAddressCount = computed(() => Math.max(1, Number(props.order?.quantity) || 1))
const addressCount = ref(1)
const recipients = ref([])
const errorMessage = ref('')

const formatPhoneNumber = (value) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11)
  if (numbers.length < 4) return numbers
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
}

const syncRecipients = () => {
  const next = Array.from({ length: addressCount.value }, (_, index) => ({
    name: recipients.value[index]?.name || '',
    phone: recipients.value[index]?.phone || '',
    address: recipients.value[index]?.address || '',
    detailAddress: recipients.value[index]?.detailAddress || '',
    deliveryMessage: recipients.value[index]?.deliveryMessage || '',
  }))
  recipients.value = next
}

watch(
  [addressCount, maxAddressCount],
  () => {
    if (addressCount.value > maxAddressCount.value) addressCount.value = maxAddressCount.value
    syncRecipients()
  },
  { immediate: true },
)

const handlePhoneInput = (event, index) => {
  recipients.value[index].phone = formatPhoneNumber(event.target.value)
}

const isValidPhoneNumber = (phone) => /^010-\d{4}-\d{4}$/.test(phone)

const handleConfirmGiftOrder = () => {
  for (let i = 0; i < recipients.value.length; i += 1) {
    const recipient = recipients.value[i]
    if (!recipient.name.trim())
      return (errorMessage.value = `${i + 1}번째 배송지의 받는 분 이름을 입력해 주세요.`)
    if (!isValidPhoneNumber(recipient.phone.trim()))
      return (errorMessage.value = `${i + 1}번째 배송지 연락처 형식을 확인해 주세요.`)
    if (!recipient.address.trim())
      return (errorMessage.value = `${i + 1}번째 배송지 주소를 입력해 주세요.`)
    if (!recipient.detailAddress.trim())
      return (errorMessage.value = `${i + 1}번째 배송지 상세주소를 입력해 주세요.`)
  }

  errorMessage.value = ''
  const firstRecipient = recipients.value[0]
  const recipientMemo = recipients.value
    .map(
      (recipient, index) =>
        `${index + 1}지: ${recipient.name} / ${recipient.phone} / ${recipient.address} ${recipient.detailAddress} / 메모:${recipient.deliveryMessage || '-'}`,
    )
    .join('\n')

  emit('confirm-order', {
    ...props.order,
    recipient_name: firstRecipient.name.trim(),
    recipient_phone: firstRecipient.phone.trim(),
    recipient_address:
      `${firstRecipient.address.trim()} ${firstRecipient.detailAddress.trim()}`.trim(),
    recipient_zonecode: '',
    recipient_base_address: firstRecipient.address.trim(),
    recipient_detail_address: firstRecipient.detailAddress.trim(),
    delivery_message: `[선물 주문]\n배송지 수: ${addressCount.value}곳\n${recipientMemo}`,
  })
}
</script>
