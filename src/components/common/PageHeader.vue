<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="mb-6">
    <h1 v-if="title" class="text-2xl text-black font-east-sea-dokdo">{{ title }}</h1>
    <p v-if="description" class="mb-1 text-xs text-black/40">{{ description }}</p>
  </div>
</template>
