<template>
  <div class="min-h-full bg-white px-5 pt-5 pb-10 text-black">
    <!-- 상단 안내 -->
    <div class="mb-5">
      <p class="mb-1 text-xs text-black/45">주소 검색</p>
      <h2 class="text-2xl font-semibold">주소를 선택해 주세요</h2>
    </div>

    <!-- 검색 입력 + 검색 버튼 -->
    <div class="mb-5 flex gap-2">
      <input
        v-model="keyword"
        type="text"
        class="flex-1 rounded-2xl border border-black/10 px-4 py-3 outline-none"
        placeholder="도로명, 지번, 건물명으로 검색"
        @keyup.enter="searchAddress"
      />

      <button
        type="button"
        @click="searchAddress"
        class="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
      >
        검색
      </button>
    </div>
    <!-- 로딩 -->
    <p v-if="isLoading" class="mb-4 text-sm text-black/50">주소를 검색하고 있습니다...</p>

    <!-- 에러 -->
    <p v-if="errorMessage" class="mb-4 text-sm text-red-500">
      {{ errorMessage }}
    </p>

    <!-- 결과 리스트 -->
    <div class="space-y-3">
      <button
        v-for="item in searchResults"
        :key="`${item.x}-${item.y}-${item.address_name}`"
        type="button"
        @click="selectAddress(item)"
        class="block w-full rounded-2xl border border-black/10 px-4 py-4 text-left transition hover:bg-black/[0.03]"
      >
        <p class="mb-1 text-xs text-black/45">
          {{ item.road_address?.zone_no || '우편번호 없음' }}
        </p>

        <p class="text-sm font-medium">
          {{ item.road_address?.address_name || item.address?.address_name }}
        </p>

        <p class="mt-1 text-xs text-black/50">
          {{ item.address_name }}
        </p>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import axios from 'axios'

// 부모로 선택된 주소 전달
const emit = defineEmits(['select-address'])

// 검색어 상태
const keyword = ref('')

// 검색 결과 상태
const searchResults = ref([])

// 로딩 상태
const isLoading = ref(false)

// 에러 메세지
const errorMessage = ref('')

// 카카오 주소 검색
async function searchAddress() {
  const query = keyword.value.trim()

  if (query.length < 3) {
    errorMessage.value = '도로명 또는 지번을 조금 더 구체적으로 입력해 주세요.'
    searchResults.value = []
    return
  }

  if (!query) {
    errorMessage.value = '검색어를 입력해 주세요.'
    searchResults.value = []
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: {
        query,
      },
      headers: {
        Authorization: `KakaoAK ${import.meta.env.VITE_KAKAO_REST_API_KEY}`,
      },
    })

    searchResults.value = (response.data.documents || []).filter((item) => {
      return item.address_type !== 'REGION' && item.road_address
    })

    if (searchResults.value.length === 0) {
      errorMessage.value = '검색 결과가 없습니다. 더 구체적으로 입력해 주세요.'
    }
  } catch (error) {
    console.error('주소 검색 에러:', error)
    errorMessage.value = '주소 검색 중 문제가 발생했습니다.'
    searchResults.value = []
  } finally {
    isLoading.value = false
  }
}
// 선택한 주소를 부모로 전달
function selectAddress(item) {
  const zonecode = item.road_address?.zone_no || ''
  const address = item.road_address?.address_name || item.address?.address_name || ''

  emit('select-address', {
    zonecode,
    address,
    raw: item,
  })
}
</script>
