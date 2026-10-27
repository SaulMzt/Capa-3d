import Store from '@/components/store/Store';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Store productId={id}/>}
