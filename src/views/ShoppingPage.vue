<script setup>
const detailImagePaths = [
  '/dist/assets/detail-img/260418-detail-01.jpg',
  '/dist/assets/detail-img/260418-detail-02.jpg',
]
</script>

<template>
  <div class="min-h-screen bg-white px-6 pt-3 pb-24">
    <div class="mx-auto flex max-w-[430px] flex-col gap-3">
      <img
        v-for="(detailImagePath, index) in detailImagePaths"
        :key="`${detailImagePath}-${index}`"
        :src="detailImagePath"
        :alt="`상세 페이지 이미지 ${index + 1}`"
        class="w-full rounded-lg"
      />
    </div>
  </div>
</template>
