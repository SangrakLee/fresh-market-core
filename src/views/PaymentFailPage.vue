<script setup>
import { computed } from 'vue' // 이번에 추가
import { useRoute, useRouter } from 'vue-router' // 이번에 추가

const route = useRoute() // 이번에 추가
const router = useRouter() // 이번에 추가

const code = computed(() => route.query.code || '') // 이번에 추가
const message = computed(() => route.query.message || '') // 이번에 추가
</script>

<template>
  <div class="min-h-screen bg-white px-6 py-10 text-black">
    <div class="mx-auto max-w-md">
      <p class="mb-2 text-xs tracking-[0.2em] text-black/40 uppercase">고마마정품</p>
      <h1 class="text-2xl font-bold">결제가 취소되었어요</h1>
      <p class="mt-3 text-sm text-black/60">결제를 다시 진행하시거나 주문 내용을 확인해 주세요.</p>

      <div class="mt-6 rounded-2xl border border-black/10 bg-black/[0.03] p-4">
        <p class="text-xs text-black/40">code</p>
        <p class="text-sm font-medium">{{ code || '없음' }}</p>

        <p class="mt-4 text-xs text-black/40">message</p>
        <p class="text-sm font-medium">
          {{ message || '사용자가 결제를 취소했거나 결제가 실패했습니다.' }}
        </p>
      </div>

      <div class="mt-6 flex gap-3">
        <button
          class="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          @click="router.push('/')"
        >
          메인으로 가기
        </button>
      </div>
    </div>
  </div>
</template>
