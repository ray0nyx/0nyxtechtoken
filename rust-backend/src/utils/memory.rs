use std::mem::MaybeUninit;

pub struct FastBuffer<T, const N: usize> {
    data: [MaybeUninit<T>; N],
    len: usize,
}

impl<T, const N: usize> FastBuffer<T, N> {
    pub fn new() -> Self {
        // Create an uninitialized array to avoid zeroing out memory
        // This is safe because we track the length and only access initialized parts
        let data = unsafe { MaybeUninit::uninit().assume_init() };
        FastBuffer { data, len: 0 }
    }

    pub fn push(&mut self, val: T) {
        if self.len < N {
            self.data[self.len] = MaybeUninit::new(val);
            self.len += 1;
        }
    }

    pub fn as_slice(&self) -> &[T] {
        // Safe because we only return the initialized portion
        unsafe { std::mem::transmute(&self.data[0..self.len]) }
    }
}

