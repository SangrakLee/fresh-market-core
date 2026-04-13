<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

onMounted(async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('콜백 처리 에러:', error.message)
  }

  router.replace('/')
})
</script>

<template>
  <div class="p-4">로그인 처리 중...</div>
</template>
