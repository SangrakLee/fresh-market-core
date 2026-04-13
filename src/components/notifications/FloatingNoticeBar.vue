<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const isVisible = ref(true)

const closeBanner = () => {
  isVisible.value = false
}
</script>

<template>
  <transition name="notice-fade">
    <div
      v-if="isVisible"
      class="fixed bottom-[60px] left-0 right-0 z-40 px-3"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <div
        class="mx-auto flex h-[58px] max-w-[430px] items-center justify-between rounded-[18px] border border-[#18d7df]/40 bg-[#051737] px-3 shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
      >
        <!-- 왼쪽 라벨 -->
        <div class="mr-3 flex h-[32px] shrink-0 items-center rounded-[8px] bg-[#00d7de] px-3">
          <span class="text-[13px] font-extrabold tracking-[-0.02em] text-[#04213f]">
            고정회원
          </span>
        </div>

        <!-- 가운데 문구 -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-extrabold tracking-[-0.03em] text-white">
            카카오 친구 추가하면 2천원 쿠폰 받아요!
          </p>
        </div>

        <!-- 닫기 버튼 -->
        <button
          type="button"
          class="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          @click="closeBanner"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.notice-fade-enter-active,
.notice-fade-leave-active {
  transition: all 0.22s ease;
}

.notice-fade-enter-from,
.notice-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
