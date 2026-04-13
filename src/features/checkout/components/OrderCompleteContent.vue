<template>
  <div class="min-h-full bg-white px-6 pt-10 pb-24 text-black">
    <!-- 완료 아이콘 느낌 -->
    <div class="mb-6 flex justify-center">
      <div class="flex h-20 w-20 items-center justify-center rounded-full bg-[#22d3c5]/15">
        <span class="text-4xl">✓</span>
      </div>
    </div>

    <!-- 완료 메시지 -->
    <div class="text-center">
      <p class="mb-2 text-sm text-black/50">주문 완료</p>
      <h2 class="mb-3 text-2xl font-semibold">주문이 접수되었습니다</h2>
      <p class="mx-auto max-w-xs text-sm leading-7 text-black/65">
        주문 내용을 확인한 뒤 순차적으로 안내드릴게요.
      </p>
    </div>

    <!-- 주문 요약 -->
    <div class="mt-8 rounded-3xl bg-black/[0.04] p-5">
      <p class="mb-1 text-xs text-black/45">주문 상품</p>
      <p class="text-base font-semibold">{{ order.product_name }}</p>
      <p class="mt-2 text-sm text-black/65">{{ order.option_name }} · {{ order.quantity }}개</p>
      <p class="mt-4 text-sm text-black/50">총 금액</p>
      <strong class="mt-1 block text-xl font-semibold">
        {{ order.total_amount.toLocaleString() }}원
      </strong>
    </div>

    <!-- 하단 CTA -->
    <div
      class="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-[375px] rounded-t-3xl border-t border-black/10 bg-white px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
    >
      <button
        type="button"
        @click="$emit('close-complete')"
        class="w-full rounded-2xl bg-black px-5 py-4 text-base font-semibold text-white active:scale-[0.98] transition"
      >
        확인
      </button>
    </div>
  </div>
</template>

<script setup>
// 완료 화면에 보여줄 주문 정보
defineProps({
  order: {
    type: Object,
    required: true,
  },
})

// 부모로 닫기 이벤트 전달
defineEmits(['close-complete'])
</script>
