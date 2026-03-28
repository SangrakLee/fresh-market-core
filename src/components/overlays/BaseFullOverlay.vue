<template>
  <!-- 전체 화면 덮는 오버레이 -->
  <transition name="slide">
    <div v-if="modelValue" class="fixed inset-0 z-50 bg-black">
      <!-- 상단 헤더 -->
      <div class="flex items-center h-14 px-4 border-b border-white/10">
        <!-- 뒤로가기 -->
        <button @click="close" class="text-white text-xl active:scale-90 transition">
          <ChevronLeft class="w-6 h-6 opacity-90 active:opacity-60 transition" />
        </button>

        <!-- [옵션] 타이틀 -->
        <span class="ml-3 text-white text-sm opacity-80"> 상품 정보 </span>
      </div>

      <!-- 컨텐츠 영역 -->
      <div class="h-[calc(100%-56px)] overflow-y-auto">
        <slot />
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ChevronLeft } from 'lucide-vue-next'

// v-model 받기
const props = defineProps({
  modelValue: Boolean,
})

// 부모로 닫기 전달
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
/* 오른쪽 → 왼쪽 애니메이션 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-enter-to {
  transform: translateX(0);
}

.slide-leave-from {
  transform: translateX(0);
}

.slide-leave-to {
  transform: translateX(100%);
}
</style>
