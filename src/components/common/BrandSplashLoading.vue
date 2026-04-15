<script setup>
import landingImage from '@/assets/images/gomamaLanding260323.jpg'

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '고마마정품',
  },
  description: {
    type: String,
    default: '주문 정보를 준비하고 있어요...',
  },
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black"
      >
        <img
          :src="landingImage"
          alt="고마마정품 스플래시"
          class="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div class="absolute inset-0 bg-black/55" />

        <div class="relative text-center text-white">
          <p class="text-xs tracking-[0.3em] text-white/70 uppercase">{{ title }}</p>
          <p class="mt-3 text-3xl font-east-sea-dokdo">잠시만 기다려주세요</p>
          <p class="mt-2 text-sm text-white/85">{{ description }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
