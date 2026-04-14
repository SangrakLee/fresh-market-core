<template>
  <div v-if="showHeader" class="mx-auto max-w-[430px] px-6 pt-8">
    <PageHeader :title="pageTitle" :description="pageDescription" />
  </div>
  <router-view />
  <FloatingNoticeBar />
  <BottomNavBar :session="session" />
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/common/PageHeader.vue'
import FloatingNoticeBar from '@/components/notifications/FloatingNoticeBar.vue'
import BottomNavBar from '@/components/navigation/BottomNavBar.vue'

const route = useRoute()

const session = ref(null)
let authSubscription = null

const pageTitle = computed(() => route.meta.title || '')
const pageDescription = computed(() => route.meta.description || '')
const showHeader = computed(() => !!route.meta.title)

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
