<template>
  <div class="min-h-full bg-white px-5 pt-5 pb-32 text-black">
    <div class="mb-6">
      <p class="mb-1 text-xs text-black/50">주문내역</p>
      <h2 class="text-xl font-semibold">내 주문 목록</h2>
    </div>

    <div v-if="isLoading" class="text-sm text-black/50">주문내역 불러오는 중...</div>

    <div v-else-if="!orders.length" class="text-sm text-black/50">아직 주문내역이 없습니다.</div>

    <div v-else class="space-y-4">
      <div v-for="order in orders" :key="order.id" class="rounded-2xl border border-black/10 p-4">
        <div class="mb-2">
          <div class="text-sm font-semibold">{{ order.product_name }}</div>
          <div class="text-sm text-black/60">{{ order.option_name }} · {{ order.quantity }}개</div>
        </div>

        <div class="space-y-1 text-sm text-black/70">
          <p>받는 분: {{ order.recipient_name }}</p>
          <p>연락처: {{ order.recipient_phone }}</p>
          <p>주소: {{ order.recipient_address }}</p>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <div class="text-base font-semibold">{{ order.total_amount.toLocaleString() }}원</div>

          <button
            class="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            @click="$emit('reorder', order)"
          >
            지난 주문 그대로
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  orders: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['reorder'])
</script>
