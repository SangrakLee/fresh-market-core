<template>
  <!-- 전체 영역 -->
  <div v-if="modelValue" class="fixed inset-0 z-50">
    <!-- 배경 오버레이 -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

    <!-- 바텀시트 -->
    <div
      class="absolute bottom-0 left-0 w-full max-w-[375px] mx-auto right-0 bg-white/10 backdrop-blur-lg border border-white/20 rounded-t-2xl p-4 transition-transform duration-300"
      :class="show ? 'translate-y-0' : 'translate-y-full'"
    >
      <!-- 드래그 핸들 느낌 -->
      <div class="w-10 h-1 bg-white/40 rounded-full mx-auto mb-4"></div>

      <!-- 슬롯 (내용 들어가는 곳) -->
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: Boolean,
})

const emit = defineEmits(['update:modelValue'])

const show = ref(false)

// 열릴 때 애니메이션 트리거
watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      await nextTick()
      show.value = true
    } else {
      show.value = false
    }
  },
)

function close() {
  show.value = false
  setTimeout(() => {
    emit('update:modelValue', false)
  }, 300)
}
</script>
