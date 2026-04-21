<script setup>
import { Citrus } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const detailImageModules = import.meta.glob('../assets/images/detail-img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const detailImagePaths = Object.values(detailImageModules).sort()

const products = ref([])
const isLoading = ref(false)
const loadError = ref('')
const activeTab = ref(null)
const selectedWeights = ref([])
const quantities = ref({})
const isMember = ref(false)
const productName = ref('참외')
const router = useRouter()

const activeProduct = computed(
  () =>
    products.value.find((product) => product.key === activeTab.value) ?? products.value[0] ?? null,
)

const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price)

const totalPrice = computed(() =>
  selectedWeights.value.reduce((total, key) => {
    const product = products.value.find((item) => item.key === key)

    if (!product) {
      return total
    }

    const unitPrice = isMember.value ? product.memberPrice : product.guestPrice
    return total + unitPrice * (quantities.value[key] ?? 1)
  }, 0),
)

const increaseQuantity = (key) => {
  quantities.value[key] = (quantities.value[key] ?? 1) + 1
}

const decreaseQuantity = (key) => {
  const currentQuantity = quantities.value[key] ?? 1
  quantities.value[key] = Math.max(1, currentQuantity - 1)
}

const loadProductOptions = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (productError) {
      throw productError
    }
    productName.value = productData.name || '참외'

    const { data: optionData, error: optionError } = await supabase
      .from('product_options')
      .select('id, name, price')
      .eq('product_id', productData.id)
      .order('id', { ascending: true })

    if (optionError) {
      throw optionError
    }

    products.value = (optionData || []).map((option, index) => ({
      key: option.id,
      label: option.name,
      guestPrice: option.price,
      memberPrice: Math.max(option.price - 2000, 0),
      imagePath: detailImagePaths[index] ?? '',
    }))

    quantities.value = products.value.reduce((acc, option) => {
      acc[option.key] = 1
      return acc
    }, {})

    selectedWeights.value = []
    activeTab.value = products.value[0]?.key ?? null
  } catch (error) {
    console.error('상품 옵션 로딩 에러:', error)
    loadError.value = '상품 옵션을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadProductOptions()
})

const moveToLandingCheckout = () => {
  if (!selectedWeights.value.length) {
    alert('옵션을 1개 이상 선택해 주세요.')
    return
  }

  const selectedProducts = products.value.filter((product) =>
    selectedWeights.value.includes(product.key),
  )
  const totalQuantity = selectedProducts.reduce(
    (sum, product) => sum + (quantities.value[product.key] ?? 1),
    0,
  )

  const optionSummary = selectedProducts
    .map((product) => `${product.label} ${quantities.value[product.key] ?? 1}개`)
    .join(', ')

  router.push({
    path: '/',
    query: {
      reorder: '1',
      product_id: '0',
      product_name: productName.value,
      option_id: '0',
      option_name: optionSummary,
      quantity: String(totalQuantity),
      total_amount: String(totalPrice.value),
    },
  })
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto flex max-w-[430px] flex-col">
      <div class="bg-white px-2 shadow-sm">
        <div class="flex items-center justify-start gap-2">
          <button
            v-for="product in products"
            :key="product.key"
            type="button"
            class="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition"
            @click="activeTab = product.key"
          >
            <span
              class="flex h-9 w-9 items-center justify-center rounded-full"
              :class="
                activeTab === product.key
                  ? 'border-yellow-400 bg-yellow-100 text-yellow-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              "
            >
              <Citrus class="h-4 w-4" aria-hidden="true" />
            </span>
            <span
              class="text-[11px] font-semibold"
              :class="activeTab === product.key ? 'text-gray-900' : 'text-gray-500'"
            >
              {{ product.label }}
            </span>
            <span
              class="h-0.5 w-7 rounded-full"
              :class="activeTab === product.key ? 'bg-yellow-400' : 'bg-transparent'"
            />
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="rounded-xl bg-white p-5 text-sm text-gray-600 shadow-sm">
        상품 정보를 불러오는 중입니다...
      </div>
      <div v-else-if="loadError" class="rounded-xl bg-white p-5 text-sm text-red-500 shadow-sm">
        {{ loadError }}
      </div>
      <div v-else class="overflow-hidden rounded-xl bg-white shadow-sm">
        <img
          v-if="activeProduct?.imagePath"
          :src="activeProduct.imagePath"
          :alt="`${activeProduct.label} 상품 이미지`"
          class="h-[600px] w-full object-cover"
        />
        <div v-else class="flex h-[600px] items-center justify-center text-sm text-gray-500">
          이미지가 준비되지 않았습니다.
        </div>
      </div>

      <div v-if="!isLoading && !loadError" class="bg-white p-3">
        <label class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <input v-model="isMember" type="checkbox" class="h-4 w-4" />
          <span>회원가 적용</span>
        </label>

        <div class="flex flex-col gap-3">
          <label
            v-for="product in products"
            :key="`checkbox-${product.key}`"
            class="rounded-lg border border-gray-200 p-3"
          >
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-gray-800">
                <input
                  v-model="selectedWeights"
                  type="checkbox"
                  :value="product.key"
                  class="h-4 w-4"
                />
                <span class="font-semibold">{{ product.label }}</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="h-7 w-7 rounded-md border border-gray-300 text-base text-gray-700"
                  @click.prevent="decreaseQuantity(product.key)"
                >
                  -
                </button>
                <span class="w-6 text-center text-sm font-medium text-gray-800">
                  {{ quantities[product.key] }}
                </span>
                <button
                  type="button"
                  class="h-7 w-7 rounded-md border border-gray-300 text-base text-gray-700"
                  @click.prevent="increaseQuantity(product.key)"
                >
                  +
                </button>
              </div>
            </div>
            <div class="space-y-1 pl-6 text-sm">
              <p class="text-gray-600">비회원가 {{ formatPrice(product.guestPrice) }}원</p>
              <p class="font-medium text-green-600">
                회원가 {{ formatPrice(product.memberPrice) }}원
              </p>
            </div>
          </label>
        </div>

        <div class="mt-4 rounded-xl bg-gray-50 p-4">
          <p class="text-base font-semibold text-gray-800">
            총 금액 {{ formatPrice(totalPrice) }}원
          </p>
          <button
            type="button"
            class="mt-3 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white"
            @click="moveToLandingCheckout"
          >
            주문하기 &gt;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
