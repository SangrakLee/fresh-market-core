<template>
  <div class="min-h-full bg-white text-black">
    <div class="text-white px-5 pt-5 pb-32">
      <!-- 상품명 -->
      <h2 class="text-lg font-semibold mb-1">{{ product.name }}</h2>

      <!-- 설명 -->
      <p class="text-sm text-white/70 mb-4">{{ product.description }}</p>

      <!-- 신뢰 요소 -->
      <div class="flex gap-2 mb-5 text-xs">
        <span class="px-2 py-1 bg-white/10 rounded-full">오늘 수확</span>
        <span class="px-2 py-1 bg-white/10 rounded-full">성주 직송</span>
        <span class="px-2 py-1 bg-white/10 rounded-full">정품 선별</span>
      </div>

      <!-- 옵션 선택 -->
      <div class="mb-5">
        <p class="text-sm mb-2">옵션 선택</p>

        <div class="flex gap-2">
          <button
            v-for="option in options"
            :key="option.id"
            @click="selectOption(option)"
            :class="[
              'px-4 py-2 rounded-full border transition',
              selectedOption?.id === option.id
                ? 'border-white bg-white text-black'
                : 'border-white/30 text-white bg-white/5',
            ]"
          >
            {{ option.name }}
          </button>
        </div>
      </div>

      <!-- 수량 -->
      <div class="mb-5">
        <p class="text-sm mb-2">수량</p>

        <div class="flex items-center gap-3">
          <button type="button" @click="decreaseQty" class="w-8 h-8 bg-white/20 rounded-full">
            -
          </button>
          <span>{{ quantity }}</span>
          <button type="button" @click="increaseQty" class="w-8 h-8 bg-white/20 rounded-full">
            +
          </button>
        </div>
      </div>
      <!-- 하단 고정 CTA -->
      <div
        class="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-[375px] rounded-t-3xl border-t border-black/10 bg-white px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
      >
        <div class="flex items-center justify-between gap-4">
          <!-- 총 금액 -->
          <div class="min-w-0">
            <p class="text-xs text-black/50">총 금액</p>
            <strong class="text-xl font-semibold"> {{ totalPrice.toLocaleString() }}원 </strong>
          </div>

          <!-- 구매 버튼 -->
          <button
            type="button"
            @click="handleSubmitOrder"
            class="flex-1 rounded-2xl bg-[#22d3c5] px-5 py-4 text-base font-semibold text-black active:scale-[0.98] transition"
          >
            {{ totalPrice.toLocaleString() }}원 구매하기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
  options: {
    type: Array,
    default: () => [],
  },
})
const selectedOption = ref(null)
const quantity = ref(1)
watch(
  () => props.options,
  (newOptions) => {
    if (newOptions.length > 0) {
      selectedOption.value = newOptions[0]
    }
  },
  { immediate: true },
)

// 옵션 선택 함수
function selectOption(option) {
  selectedOption.value = option
}

// 수량 증가
function increaseQty() {
  quantity.value++
}

// 수량 감소
function decreaseQty() {
  if (quantity.value > 1) quantity.value--
}

// props 옵션 기준 총 금액 계산
const totalPrice = computed(() => {
  if (!selectedOption.value) return 0
  return selectedOption.value.price * quantity.value
})

// 부모로 주문 데이터 전달
const emit = defineEmits(['submit-order'])

function handleSubmitOrder() {
  if (!props.product || !selectedOption.value) return

  const orderPayload = {
    product_id: props.product.id,
    product_name: props.product.name,
    option_id: selectedOption.value.id,
    option_name: selectedOption.value.name,
    quantity: quantity.value,
    total_amount: totalPrice.value,
  }
  emit('submit-order', orderPayload)
}
</script>
