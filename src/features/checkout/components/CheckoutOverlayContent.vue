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
          :value="form.recipient_phone"
          @input="handlePhoneInput"
          type="tel"
          inputmode="numeric"
          maxlength="13"
          class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="010-1234-5678"
        />
      </div>

      <!-- 주소 찾기 구조 -->
      <div>
        <label class="mb-2 block text-sm font-medium">주소</label>

        <!-- 우편번호 + 주소 찾기 버튼 -->
        <div class="mb-3 flex gap-2">
          <input
            :value="props.zonecode"
            type="text"
            readonly
            class="w-28 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 outline-none"
            placeholder="우편번호"
          />

          <button
            type="button"
            @click="emit('open-address-search')"
            class="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium"
          >
            주소 찾기
          </button>
        </div>

        <!-- 이번에 추가 시작: 지난 주문 주소 표시 -->
        <div
          v-if="order.saved_full_address && !props.baseAddress"
          class="mb-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3"
        >
          <p class="mb-1 text-xs text-black/50">지난 주문 주소</p>
          <p class="text-sm text-black/80">{{ order.saved_full_address }}</p>
        </div>
        <!-- 이번에 추가 끝: 지난 주문 주소 표시 -->

        <!-- 기본주소 -->
        <input
          :value="props.baseAddress"
          type="text"
          readonly
          class="mb-3 w-full rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 outline-none"
          placeholder="기본주소"
        />

        <!-- 상세주소 -->
        <input
          ref="detailAddressInput"
          v-model="form.recipient_address"
          type="text"
          class="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none"
          placeholder="상세주소 입력"
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
        :disabled="props.isSubmitting"
        :class="[
          'w-full rounded-2xl bg-[#22d3c5] px-5 py-4 text-base font-semibold text-black active:scale-[0.98] transition',
          props.isSubmitting
            ? 'bg-black/20 text-black/40 cursor-not-allowed'
            : 'bg-[#22d3c5] text-black active:scale-[0.98]',
        ]"
      >
        {{
          props.isSubmitting
            ? '주문 저장 중...'
            : `${order.total_amount.toLocaleString()}원 주문하기`
        }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, nextTick } from 'vue'

const detailAddressInput = ref(null)

// 부모에서 주문 데이터 받기
const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
  // 주문 저장 중 여부
  isSubmitting: {
    type: Boolean,
    default: false,
  },
  // 선택된 주소 정보 받기
  zonecode: {
    type: String,
    default: '',
  },
  baseAddress: {
    type: String,
    default: '',
  },
  profileFullName: {
    type: String,
    default: '',
  },
  profilePhone: {
    type: String,
    default: '',
  },
  profileZonecode: {
    type: String,
    default: '',
  },
  profileBaseAddress: {
    type: String,
    default: '',
  },
  profileDetailAddress: {
    type: String,
    default: '',
  },
})
// 주소 선택 후 상세주소로 포커스 이동
watch(
  () => props.baseAddress,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      detailAddressInput.value?.focus()
    }
  },
)
// 부모로 최종 주문 데이터 전달
const emit = defineEmits(['confirm-order', 'open-address-search'])
// 체크아웃 폼 상태
const form = reactive({
  recipient_name: '',
  recipient_phone: '',
  recipient_address: '',
  delivery_message: '',
})
const applyProfileDefaults = () => {
  form.recipient_name = props.order?.recipient_name || props.profileFullName || ''
  form.recipient_phone = props.order?.recipient_phone || props.profilePhone || ''
  form.recipient_address = props.order?.recipient_detail_address || props.profileDetailAddress || ''
  form.delivery_message = props.order?.delivery_message || ''
}
watch(
  () => [props.order, props.profileFullName, props.profilePhone, props.profileDetailAddress],
  () => {
    applyProfileDefaults()
  },
  { immediate: true, deep: true },
)
// 주문 확인 클릭
const errorMessage = ref('')
// 연락처 숫자만 남기기 + 자동 하이픈
function formatPhoneNumber(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 11)

  if (numbers.length < 4) return numbers
  if (numbers.length < 8) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
}
// input 입력 시 자동 포맷
function handlePhoneInput(event) {
  form.recipient_phone = formatPhoneNumber(event.target.value)
}
// 연락처 형식 검증
function isValidPhoneNumber(phone) {
  return /^010-\d{4}-\d{4}$/.test(phone)
}
function handleConfirmOrder() {
  const recipientName = form.recipient_name.trim()
  const recipientPhone = form.recipient_phone.trim()
  const recipientAddress = form.recipient_address.trim()
  const selectedBaseAddress = props.baseAddress.trim()
  const savedFullAddress = props.order?.saved_full_address?.trim() || ''
  const deliveryMessage = form.delivery_message.trim()

  if (!recipientName) {
    errorMessage.value = '받는 분 이름을 입력해 주세요.'
    return
  }

  if (!recipientPhone) {
    errorMessage.value = '연락처를 입력해 주세요.'
    return
  }
  if (!isValidPhoneNumber(recipientPhone)) {
    errorMessage.value = '연락처 형식을 확인해 주세요.'
    return
  }

  // 새 주소 선택도 없고, 지난 주문 주소도 없으면 막기
  if (!selectedBaseAddress && !savedFullAddress) {
    errorMessage.value = '주소 찾기로 기본주소를 선택해 주세요.'
    return
  }

  // 새 주소를 선택한 경우에만 상세주소 필수
  if (selectedBaseAddress && !recipientAddress) {
    errorMessage.value = '상세주소를 입력해 주세요.'
    return
  }

  errorMessage.value = ''

  const finalAddress = selectedBaseAddress
    ? `${selectedBaseAddress} ${recipientAddress}`.trim()
    : savedFullAddress

  const checkoutPayload = {
    ...props.order,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    recipient_address: finalAddress,
    recipient_zonecode: props.zonecode || '',
    recipient_base_address: selectedBaseAddress || '',
    recipient_detail_address: recipientAddress || '',
    delivery_message: deliveryMessage,
  }
  emit('confirm-order', checkoutPayload)
}
</script>
