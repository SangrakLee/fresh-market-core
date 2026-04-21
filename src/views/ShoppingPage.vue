<script setup>
import { Citrus } from 'lucide-vue-next'
import { computed, ref } from 'vue'

const detailImageModules = import.meta.glob('../assets/images/detail-img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const detailImagePaths = Object.values(detailImageModules).sort()

const weightOptions = [
  { key: '4kg', label: '4kg', guestPrice: 40000, memberPrice: 38000 },
  { key: '10kg', label: '10kg', guestPrice: 40000, memberPrice: 38000 },
]

const products = computed(() =>
  weightOptions.map((option, index) => ({
    ...option,
    imagePath: detailImagePaths[index] ?? '',
  })),
)

const activeTab = ref(weightOptions[0].key)
const selectedWeights = ref([])

const quantities = ref(
  weightOptions.reduce((acc, option) => {
    acc[option.key] = 1
    return acc
  }, {}),
)
const isMember = ref(false)

const activeProduct = computed(
  () => products.value.find((product) => product.key === activeTab.value) ?? products.value[0],
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
</script>

<template>
  <div class="min-h-screen bg-white">
    <div class="mx-auto flex max-w-[480px] flex-col">
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

      <div class="overflow-hidden rounded-xl bg-white shadow-sm">
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

      <div class="bg-white p-3">
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
          >
            주문하기 &gt;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
