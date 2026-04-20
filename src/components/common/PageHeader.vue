<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="mb-6">
    <h1 v-if="title" class="text-2xl text-black font-east-sea-dokdo">{{ title }}</h1>
  </div>
</template>
