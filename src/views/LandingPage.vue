<template>
  <section class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0">
      <img :src="bgImg" alt="랜딩 배경 이미지" class="h-full w-full object-cover" />
    </div>

    <div class="absolute inset-0 bg-black/40"></div>
  </section>
</template>

<script setup>
import bgImg from '@/assets/images/LandingPage-image-260420.jpg'
</script>
