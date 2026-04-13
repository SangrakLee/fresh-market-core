<template>
  <router-view />
  <FloatingNoticeBar />
  <BottomNavBar :session="session" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { supabase } from '@/lib/supabase'
import FloatingNoticeBar from '@/components/notifications/FloatingNoticeBar.vue'
import BottomNavBar from '@/components/navigation/BottomNavBar.vue'

const session = ref(null)
let authSubscription = null

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  session.value = data.session || null

  const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession || null
  })

  authSubscription = authListener.subscription
})

onUnmounted(() => {
  authSubscription?.unsubscribe()
})
</script>
